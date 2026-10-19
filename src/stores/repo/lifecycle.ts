import type { CommitPageInfo, DiscoveredRepo, OperationProgress, SnapshotOptions, SnapshotScope } from '@shared/git/models'
import type { CloneRepoRequest, InitRepoRequest } from '@shared/git/models'
import type { RepositoryData } from '@/types/git'
import { gitService } from '@/lib/git'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'
import { syncBranchLaneColors } from '@/lib/graph/syncBranchLaneColors'
import { headCommitIndex } from '@/lib/graph/pendingGraphRow'
import { buildGraphLayout, appendGraphLayout, EMPTY_LAYOUT, EMPTY_PAGE } from './graphLayout'
import { graphSnapshotOptions, scheduleSnapshotRefresh } from './refreshScheduler'
import { scheduleDiffReload } from './diffReloadScheduler'
import { resetPerRepoUiState } from './resetPerRepoUi'
import { isAutoFetchInFlight } from './gitActions'
import { useRepoTabsStore } from '@/stores/repoTabs'
import { applyCachedTabState, useRepoTabCacheStore, type CachedTabState } from '@/stores/repoTabCache'
import { markBackendRepoPending, whenBackendRepoReady } from '@/lib/tauri/backendGate'
import type { RepositoryState } from './types'
import { sameRepoPath } from '@/lib/git/repoPath'

type LifecycleStore = RepositoryState & {
  headCommitIndex: number
  $patch: (patch: Partial<RepositoryState>) => void
  onProgress(progress: OperationProgress): void
  applySnapshot(data: RepositoryData, page?: CommitPageInfo): void
  refreshSnapshot(
    scopes?: SnapshotScope[],
    extra?: Pick<SnapshotOptions, 'invalidateCommits'>,
  ): Promise<void>
  resetCommitBox(): void
  switchRepository(path: string): Promise<boolean>
  restoreCachedTab(cached: CachedTabState, token: number): boolean
  activateBackend(path: string): Promise<string | null>
  openRepository(path: string, options?: { silent?: boolean }): Promise<boolean>
  adoptOpenedRepository(result: { ok: boolean; data?: RepositoryData; message: string }): Promise<boolean>
  cloneRepository(request: CloneRepoRequest): Promise<boolean>
  initRepository(request: InitRepoRequest): Promise<boolean>
  discoverRepositories(root: string): Promise<DiscoveredRepo[]>
  restartAutoFetch(): void
  stopAutoFetch(): void
}

let changeUnsub: (() => void) | null = null
let progressUnsub: (() => void) | null = null

/**
 * Monotonic token for "which repository switch is the newest". The backend
 * serves a single open repository and every lifecycle write lands in the
 * singleton repo store, so any open/refresh completed after a newer switch
 * started must not touch the store — otherwise whichever IPC finished last
 * would paint the wrong repository into the visible tab.
 */
let switchToken = 0

export const lifecycleActions = {
  async init(this: LifecycleStore): Promise<void> {
    this.recentRepos = await gitService.recentRepos()
    changeUnsub?.()
    progressUnsub?.()
    changeUnsub = gitService.onRepositoryChanged((event) => {
      // The backend watches exactly one repo. A stale watcher (tab preloads,
      // re-points that are still settling) can emit events for another
      // repository: never refresh the visible tab with another repo's data.
      if (this.repository && event.path && !sameRepoPath(event.path, this.repository.path)) {
        return
      }
      scheduleSnapshotRefresh((scopes) => this.refreshSnapshot(scopes), event.scopes)
    })
    progressUnsub = gitService.onProgress((progress) => this.onProgress(progress))
  },

  onProgress(this: LifecycleStore, progress: OperationProgress): void {
    // Silent auto-fetch must never flash the progress banner or steal
    // the cancel button. Manual operations always set `busyAction`
    // (`runAction`) or `loading` (clone), so anything arriving with
    // neither is background noise.
    if (isAutoFetchInFlight() && !this.busyAction && !this.loading) return
    if (progress.done) {
      this.operationPhase = null
      this.canCancel = false
      return
    }
    this.operationPhase = progress.phase
    this.canCancel = true
  },

  async cancelOperation(this: LifecycleStore): Promise<void> {
    await gitService.cancelActiveOperation()
    this.operation = null
    this.operationPhase = null
    this.busyAction = null
    this.branchSwitching = false
    this.refreshing = false
    this.canCancel = false
  },

  applySnapshot(this: LifecycleStore, data: RepositoryData, page?: CommitPageInfo): void {
    // Compute layout from the incoming data (not from `this`) so the whole
    // snapshot can land in a single $patch notification.
    const headIndex = headCommitIndex(data.commits, data.repository.headSha)
    const layout = buildGraphLayout(data.commits, headIndex)
    const branches = syncBranchLaneColors(data.branches, data.commits, layout)
    this.$patch({
      repository: data.repository,
      commits: data.commits,
      branches,
      tags: data.tags,
      stashes: data.stashes,
      worktrees: data.worktrees,
      workingTree: data.workingTree,
      commitAuthor: data.commitAuthor,
      commitPage: page ?? gitService.commitPage ?? { ...EMPTY_PAGE },
      layout,
    })
  },

  resetCommitBox(this: LifecycleStore): void {
    this.commitMessage = ''
    this.commitDescription = ''
    this.amend = false
    this.preAmendDraft = null
  },

  /**
   * Re-points the backend's single open repository at `path` (see
   * `git_activate_repo`). Returns the canonical path the backend now serves,
   * or null when the service cannot activate (missing backend command, or a
   * failure that must not abort the switch). Callers keep using the path they
   * passed when null is returned.
   */
  async activateBackend(this: LifecycleStore, path: string): Promise<string | null> {
    if (typeof gitService.activateRepository !== 'function') return null
    try {
      const result = await gitService.activateRepository(path)
      return result.ok ? (result.path ?? null) : null
    } catch (err) {
      console.error('[git-light] backend repo activation failed:', err)
      return null
    }
  },

  async switchRepository(this: LifecycleStore, path: string): Promise<boolean> {
    if (sameRepoPath(this.repository?.path, path)) {
      // Re-selecting the repository that is already on screen: show it as-is
      // and abandon any switch still in flight — it would otherwise paint
      // itself over this tab (and leave its skeleton up) when it lands.
      ++switchToken
      this.pendingRepoPath = null
      useRepoTabsStore().setActive(path)
      return true
    }

    // Claim the newest-switch token up front: only the latest switch may
    // write to the store once a backend round-trip completes.
    const token = ++switchToken
    // Any switch supersedes the skeleton of a slower one still in flight (a
    // cached tab paints instantly, so nothing should stay covered).
    this.pendingRepoPath = null

    const cache = useRepoTabCacheStore()
    // Best-effort: a cache failure must never break switching tabs. Save
    // BEFORE touching any state so the previous repo stays restorable.
    try {
      cache.save(this)
    } catch (err) {
      console.error('[git-light] tab cache save failed:', err)
    }

    // A cached tab paints immediately and re-points the backend in the
    // background (`restoreCachedTab`); a cold tab has nothing to show until
    // the snapshot arrives, and `git_open_repo` re-points the backend itself,
    // so no separate activation round-trip is needed here.
    let cached: CachedTabState | undefined
    try {
      cached = cache.get(path)
    } catch (err) {
      console.error('[git-light] tab cache read failed:', err)
    }
    if (cached) return this.restoreCachedTab(cached, token)

    resetPerRepoUiState()
    this.resetCommitBox()
    this.searchOpen = false

    // The clicked tab is the one the user asked for: highlight it (and let the
    // loading skeleton name it) before the snapshot lands, so the tab bar never
    // points at the repository being replaced. Reverted on failure, but only
    // while this switch is still the newest one — `loading` is set by any newer
    // cold switch, and a newer cached one re-points the highlight itself.
    const tabs = useRepoTabsStore()
    const previousActive = tabs.activePath
    tabs.setActive(path)

    // User-initiated: report failures instead of staying silent.
    const ok = await this.openRepository(path)
    // `setActive` ignores paths without a tab, and the tab being left (or the
    // repository still in the store) is the right place to fall back to.
    const revertTo = previousActive ?? this.repository?.path
    if (!ok && !this.loading && tabs.activePath === path && revertTo) tabs.setActive(revertTo)
    return ok
  },

  /**
   * Paints an already-cached tab snapshot and revalidates it in the background.
   *
   * The snapshot is applied synchronously so the tab is usable the instant it
   * is clicked; `git_activate_repo` (validation + watcher restart, ~100-250ms)
   * runs afterwards. Refreshes are gated on it (`whenBackendRepoReady`) so a
   * snapshot fetch can never answer for the repo we just left.
   *
   * `cached.repository.path` is the canonical spelling the backend resolved
   * when the tab was last opened, so it is also the path to activate.
   */
  restoreCachedTab(this: LifecycleStore, cached: CachedTabState, token: number): boolean {
    const activePath = cached.repository.path || cached.path

    resetPerRepoUiState()
    this.resetCommitBox()
    this.searchOpen = false
    applyCachedTabState(this, cached)
    this.screen = 'main'
    useRepoTabsStore().setActive(activePath)
    useUiStore().setLastRepositoryPath(activePath)
    this.restartAutoFetch()

    const activation = markBackendRepoPending(this.activateBackend(activePath))

    // Revalidate in the background; never let this reject unhandled.
    // Guarded by the switch token: if the user switched again meanwhile,
    // the stale result must not overwrite the now-active repo (`refreshSnapshot`
    // has an additional per-repo path guard at the data level). Fresh
    // caches (<30s) only refresh working-tree status, which is the only
    // scope that changes frequently while a tab is inactive.
    const age = Date.now() - (cached.savedAt ?? 0)
    void (async () => {
      try {
        await activation
        if (switchToken !== token) return
        if (age < 30_000) {
          await this.refreshSnapshot(['status'])
          return
        }
        const result = await gitService.openRepository(activePath, graphSnapshotOptions())
        if (switchToken !== token) return
        if (result.ok && result.data) {
          this.applySnapshot(result.data)
          try {
            useRepoTabCacheStore().save(this)
          } catch (err) {
            console.error('[git-light] tab cache save failed:', err)
          }
          return
        }
        useRepoTabCacheStore().remove(activePath)
        if (sameRepoPath(this.repository?.path, activePath)) await this.openRepository(activePath)
      } catch (err) {
        console.error('[git-light] tab background refresh failed:', err)
      }
    })()
    return true
  },

  async openRepository(this: LifecycleStore, path: string, options?: { silent?: boolean }): Promise<boolean> {
    const toast = useToastStore()
    const token = ++switchToken
    const previousPath = this.repository?.path
    const isSwitch = Boolean(previousPath && !sameRepoPath(previousPath, path))
    if (isSwitch) {
      try {
        useRepoTabCacheStore().save(this)
      } catch (err) {
        console.error('[git-light] tab cache save failed:', err)
      }
      resetPerRepoUiState()
      this.resetCommitBox()
      this.searchOpen = false
    }
    this.loading = true
    // A switch keeps the outgoing repository in the store until the snapshot
    // lands; `pendingRepoPath` is what the UI turns into a loading skeleton
    // instead of painting that stale repository for the round-trip.
    if (isSwitch) this.pendingRepoPath = path
    let result: { ok: boolean; data?: RepositoryData; message: string }
    try {
      const opening = gitService.openRepository(path, graphSnapshotOptions())
      // A switch leaves the backend serving the previous repository until
      // `git_open_repo` lands. Hold repo-scoped commands (diff, blame, and
      // destructive actions above all) for that round-trip, exactly like a
      // cached switch holds them for `git_activate_repo`.
      if (isSwitch) markBackendRepoPending(opening)
      result = await opening
    } catch (err) {
      console.error('[git-light] open repository failed:', err)
      this.loading = false
      // A newer switch is in charge of the UI; stay quiet.
      if (switchToken !== token) return false
      if (!options?.silent) toast.push(`Could not open ${path}.`, 'error')
      return false
    } finally {
      // The flag names the path this call is loading, so clearing it here (not
      // behind the token guard) means a switch that got superseded still drops
      // its own skeleton instead of covering the tab the user moved on to.
      if (this.pendingRepoPath === path) this.pendingRepoPath = null
    }
    this.loading = false
    if (!result.ok || !result.data) {
      if (switchToken !== token) return false
      if (!options?.silent) toast.push(result.message, 'error')
      return false
    }
    if (switchToken !== token) return false
    this.applySnapshot(result.data)
    this.screen = 'main'
    // Use the canonical path the backend resolved: every later lookup (tab
    // identity, cache keys, favorites) keys off this spelling.
    const activePath = result.data.repository?.path ?? path
    const name = result.data.repository?.name ?? path
    useRepoTabsStore().addTab(activePath, name)
    try {
      useRepoTabCacheStore().save(this)
    } catch (err) {
      console.error('[git-light] tab cache save failed:', err)
    }
    this.recentRepos = await gitService.recentRepos()
    if (switchToken !== token) return true
    useRepoTabsStore().syncFromRecent(this.recentRepos)
    useUiStore().setLastRepositoryPath(activePath)
    if (!options?.silent) toast.push(result.message, 'success')
    this.restartAutoFetch()
    return true
  },

  async pickAndOpenRepository(this: LifecycleStore): Promise<boolean> {
    const toast = useToastStore()
    const token = ++switchToken
    const previousPath = this.repository?.path
    this.loading = true
    const result = await gitService.pickAndOpenRepository(graphSnapshotOptions())
    this.loading = false
    if (result.cancelled) return false
    if (!result.ok || !result.data) {
      if (switchToken !== token) return false
      if (result.message) toast.push(result.message, 'error')
      return false
    }
    if (switchToken !== token) return false
    const repoPath = result.data.repository?.path
    if (previousPath && repoPath && previousPath !== repoPath) {
      resetPerRepoUiState()
      this.resetCommitBox()
      this.searchOpen = false
    }
    this.applySnapshot(result.data)
    this.screen = 'main'
    if (repoPath) {
      useRepoTabsStore().addTab(repoPath, result.data.repository?.name ?? repoPath)
      useRepoTabCacheStore().save(this)
      useUiStore().setLastRepositoryPath(repoPath)
    }
    this.recentRepos = await gitService.recentRepos()
    if (switchToken !== token) return true
    useRepoTabsStore().syncFromRecent(this.recentRepos)
    toast.push(result.message, 'success')
    this.restartAutoFetch()
    return true
  },

  async adoptOpenedRepository(
    this: LifecycleStore,
    result: { ok: boolean; data?: RepositoryData; message: string },
  ): Promise<boolean> {
    const toast = useToastStore()
    if (!result.ok || !result.data) {
      if (result.message) toast.push(result.message, 'error')
      return false
    }
    const token = ++switchToken
    const previousPath = this.repository?.path
    const repoPath = result.data.repository?.path
    if (previousPath && repoPath && previousPath !== repoPath) {
      resetPerRepoUiState()
      this.resetCommitBox()
      this.searchOpen = false
    }
    if (switchToken !== token) return false
    this.applySnapshot(result.data)
    this.screen = 'main'
    if (repoPath) {
      useRepoTabsStore().addTab(repoPath, result.data.repository?.name ?? repoPath)
      try {
        useRepoTabCacheStore().save(this)
      } catch (err) {
        console.error('[git-light] tab cache save failed:', err)
      }
      useUiStore().setLastRepositoryPath(repoPath)
    }
    this.recentRepos = await gitService.recentRepos()
    useRepoTabsStore().syncFromRecent(this.recentRepos)
    toast.push(result.message, 'success')
    this.restartAutoFetch()
    return true
  },

  async cloneRepository(this: LifecycleStore, request: CloneRepoRequest): Promise<boolean> {
    const toast = useToastStore()
    this.loading = true
    try {
      const result = await gitService.cloneRepository(request, graphSnapshotOptions())
      return await this.adoptOpenedRepository(result)
    } catch (err) {
      console.error('[git-light] clone repository failed:', err)
      toast.push('Clone failed.', 'error')
      return false
    } finally {
      this.loading = false
    }
  },

  async initRepository(this: LifecycleStore, request: InitRepoRequest): Promise<boolean> {
    const toast = useToastStore()
    this.loading = true
    try {
      const result = await gitService.initRepository(request, graphSnapshotOptions())
      return await this.adoptOpenedRepository(result)
    } catch (err) {
      console.error('[git-light] init repository failed:', err)
      toast.push('Could not initialize repository.', 'error')
      return false
    } finally {
      this.loading = false
    }
  },

  async discoverRepositories(this: LifecycleStore, root: string): Promise<DiscoveredRepo[]> {
    try {
      return await gitService.discoverRepositories({ root, maxDepth: 2 })
    } catch (err) {
      console.error('[git-light] discover repositories failed:', err)
      return []
    }
  },

  async closeRepository(this: LifecycleStore): Promise<void> {
    this.stopAutoFetch()
    // Invalidate any open/switch still in flight: its result must not repaint
    // a repository the user has just closed.
    ++switchToken
    this.pendingRepoPath = null
    await gitService.closeRepository()
    this.repository = null
    this.commits = []
    this.commitPage = { ...EMPTY_PAGE }
    this.branches = []
    this.tags = []
    this.stashes = []
    this.worktrees = []
    this.workingTree = []
    this.layout = EMPTY_LAYOUT
    resetPerRepoUiState()
    this.resetCommitBox()
    this.searchOpen = false
    useRepoTabsStore().clear()
    this.screen = 'startup'
    this.recentRepos = await gitService.recentRepos()
  },

  async refreshSnapshot(
    this: LifecycleStore,
    scopes?: SnapshotScope[],
    extra?: Pick<SnapshotOptions, 'invalidateCommits'>,
  ): Promise<void> {
    if (!this.repository) return
    const token = switchToken
    const targetPath = this.repository.path
    // A cached tab is painted before its backend re-point settles. Waiting
    // here keeps `git_snapshot` from answering for the repository we just
    // left (its data would be discarded by the path guard below anyway, at
    // the cost of a full wasted snapshot).
    await whenBackendRepoReady()
    if (switchToken !== token || !sameRepoPath(this.repository?.path, targetPath)) return
    try {
      const includesCommits = !scopes || scopes.includes('commits')
      const data = await gitService.refreshSnapshot(scopes, {
        ...graphSnapshotOptions(),
        ...(includesCommits && extra?.invalidateCommits ? { invalidateCommits: true } : {}),
      })
      // `git_snapshot` serves the backend's single open repository. If that
      // no longer matches the repo on screen (stray open, preload finishing
      // mid-switch), this data belongs to another repository: stashes, files,
      // branches and the repo name itself would leak into this tab. Discard
      // it and re-point the backend so the next refresh targets the view.
      if (!sameRepoPath(data.repository?.path, targetPath)) {
        if (switchToken === token) void this.activateBackend(targetPath)
        return
      }
      const full = !scopes || scopes.length === 0
      if (full) {
        this.applySnapshot(data)
      } else {
        this.repository = data.repository
        if (scopes.includes('commits')) {
          this.commits = data.commits
          this.commitPage = gitService.commitPage ?? { ...EMPTY_PAGE }
          this.layout = buildGraphLayout(this.commits, this.headCommitIndex)
        }
        if (scopes.includes('branches')) {
          this.branches = data.branches
        }
        if (scopes.includes('commits') || scopes.includes('branches')) {
          this.branches = syncBranchLaneColors(this.branches, this.commits, this.layout)
        }
        if (scopes.includes('tags')) this.tags = data.tags
        if (scopes.includes('stashes')) this.stashes = data.stashes
        if (scopes.includes('worktrees')) this.worktrees = data.worktrees
        if (scopes.includes('status')) this.workingTree = data.workingTree
      }
      scheduleDiffReload(this.workingTree, scopes)
    } catch {
      /* no repo open */
    }
  },

  async loadMoreCommits(this: LifecycleStore): Promise<void> {
    const oldestSha = this.commitPage.oldestSha
    if (!oldestSha || !this.commitPage.hasMore || this.loadingMoreCommits) return

    this.loadingMoreCommits = true
    const token = switchToken
    try {
      const ui = useUiStore()
      const result = await gitService.loadMoreCommits({
        beforeSha: oldestSha,
        limit: ui.clampedCommitGraphLimit,
        graphScope: ui.graphScope,
        // Backfilled stash bases are not part of the log window: counting
        // them in `skip` would permanently skip real commits on scope 'all'.
        skip:
          ui.graphScope === 'all'
            ? this.commits.filter((c) => !c.isStashBase).length
            : undefined,
      })
      // The page belongs to the repo selected when the request started; a
      // meanwhile-completed switch must not receive the old repo's commits.
      if (switchToken !== token) return
      if (result.commits.length === 0) {
        this.commitPage = { ...this.commitPage, hasMore: false }
        return
      }
      const existing = new Set(this.commits.map((c) => c.sha))
      const newCommits = result.commits.filter((c) => !existing.has(c.sha))
      if (newCommits.length === 0) {
        this.commitPage = { ...this.commitPage, hasMore: false }
        return
      }
      const prevCommits = this.commits
      this.commits = [...prevCommits, ...newCommits]
      this.commitPage = result.page
      this.layout = appendGraphLayout(prevCommits, newCommits, this.layout, this.headCommitIndex)
      this.branches = syncBranchLaneColors(this.branches, this.commits, this.layout)
    } finally {
      this.loadingMoreCommits = false
    }
  },

  async removeRecent(this: LifecycleStore, path: string): Promise<void> {
    this.recentRepos = await gitService.removeRecent(path)
  },

  async loadMock(this: LifecycleStore): Promise<void> {
    if (!gitService.load) return
    this.loading = true
    const data = await gitService.load()
    this.applySnapshot(data)
    this.screen = 'main'
    this.loading = false
  },

  scheduleRefresh(this: LifecycleStore, scopes?: SnapshotScope[]): void {
    scheduleSnapshotRefresh((merged) => this.refreshSnapshot(merged), scopes)
  },

  openSearch(this: LifecycleStore): void {
    this.searchOpen = true
  },

  closeSearch(this: LifecycleStore): void {
    this.searchOpen = false
  },
}
