import type { CommitPageInfo, OperationProgress, SnapshotOptions, SnapshotScope } from '@shared/git/models'
import type { RepositoryData } from '@/types/git'
import { gitService } from '@/lib/git'
import { useRepoDiffStore } from '@/stores/repoDiff'
import { useSelectionStore } from '@/stores/selection'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'
import { syncBranchLaneColors } from '@/lib/graph/syncBranchLaneColors'
import { buildGraphLayout, appendGraphLayout, EMPTY_LAYOUT, EMPTY_PAGE } from './graphLayout'
import { graphSnapshotOptions, scheduleSnapshotRefresh } from './refreshScheduler'
import { resetDiffReloadScheduler, scheduleDiffReload } from './diffReloadScheduler'
import type { RepositoryState } from './types'

type LifecycleStore = RepositoryState & {
  headCommitIndex: number
  onProgress(progress: OperationProgress): void
  applySnapshot(data: RepositoryData, page?: CommitPageInfo): void
  refreshSnapshot(
    scopes?: SnapshotScope[],
    extra?: Pick<SnapshotOptions, 'invalidateCommits'>,
  ): Promise<void>
}

let changeUnsub: (() => void) | null = null
let progressUnsub: (() => void) | null = null

export const lifecycleActions = {
  async init(this: LifecycleStore): Promise<void> {
    this.recentRepos = await gitService.recentRepos()
    changeUnsub?.()
    progressUnsub?.()
    changeUnsub = gitService.onRepositoryChanged((event) => {
      scheduleSnapshotRefresh((scopes) => this.refreshSnapshot(scopes), event.scopes)
    })
    progressUnsub = gitService.onProgress((progress) => this.onProgress(progress))
  },

  onProgress(this: LifecycleStore, progress: OperationProgress): void {
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
    this.repository = data.repository
    this.commits = data.commits
    this.branches = data.branches
    this.tags = data.tags
    this.stashes = data.stashes
    this.worktrees = data.worktrees
    this.workingTree = data.workingTree
    this.commitAuthor = data.commitAuthor
    this.commitPage = page ?? gitService.commitPage ?? { ...EMPTY_PAGE }
    this.layout = buildGraphLayout(this.commits, this.headCommitIndex)
    this.branches = syncBranchLaneColors(this.branches, this.commits, this.layout)
  },

  async openRepository(this: LifecycleStore, path: string, options?: { silent?: boolean }): Promise<boolean> {
    const toast = useToastStore()
    this.loading = true
    const result = await gitService.openRepository(path, graphSnapshotOptions())
    this.loading = false
    if (!result.ok || !result.data) {
      if (!options?.silent) toast.push(result.message, 'error')
      return false
    }
    this.applySnapshot(result.data)
    this.screen = 'main'
    this.recentRepos = await gitService.recentRepos()
    useUiStore().setLastRepositoryPath(path)
    if (!options?.silent) toast.push(result.message, 'success')
    return true
  },

  async pickAndOpenRepository(this: LifecycleStore): Promise<boolean> {
    const toast = useToastStore()
    this.loading = true
    const result = await gitService.pickAndOpenRepository(graphSnapshotOptions())
    this.loading = false
    if (result.cancelled) return false
    if (!result.ok || !result.data) {
      if (result.message) toast.push(result.message, 'error')
      return false
    }
    this.applySnapshot(result.data)
    this.screen = 'main'
    this.recentRepos = await gitService.recentRepos()
    if (result.data.repository?.path) {
      useUiStore().setLastRepositoryPath(result.data.repository.path)
    }
    toast.push(result.message, 'success')
    return true
  },

  async closeRepository(this: LifecycleStore): Promise<void> {
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
    useRepoDiffStore().resetOnRepoClose()
    useSelectionStore().cancelBranchCreation()
    resetDiffReloadScheduler()
    this.screen = 'startup'
    this.recentRepos = await gitService.recentRepos()
  },

  async refreshSnapshot(
    this: LifecycleStore,
    scopes?: SnapshotScope[],
    extra?: Pick<SnapshotOptions, 'invalidateCommits'>,
  ): Promise<void> {
    if (!this.repository) return
    try {
      const includesCommits = !scopes || scopes.includes('commits')
      const data = await gitService.refreshSnapshot(scopes, {
        ...graphSnapshotOptions(),
        ...(includesCommits && extra?.invalidateCommits ? { invalidateCommits: true } : {}),
      })
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
    try {
      const ui = useUiStore()
      const result = await gitService.loadMoreCommits({
        beforeSha: oldestSha,
        limit: ui.clampedCommitGraphLimit,
        graphScope: ui.graphScope,
        skip: ui.graphScope === 'all' ? this.commits.length : undefined,
      })
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
