import { defineStore } from 'pinia'
import type { CommitPageInfo, DiffResult, OperationProgress, RecentRepository, SnapshotOptions, SnapshotScope } from '@shared/git/models'
import type {
  Branch,
  Commit,
  GitAction,
  Repository,
  RepositoryData,
  Stash,
  Tag,
  WorkingTreeFile,
  Worktree,
} from '@/types/git'
import { computeGraphLayout, type GraphLayout } from '@/lib/graph/computeGraphLayout'
import type { SnapshotRefreshOptions } from '@/lib/git/GitService'
import { gitService } from '@/lib/git'
import { isDestructiveAction } from '@/lib/git/destructive'
import { usePromptStore } from './prompt'
import { useSelectionStore } from './selection'
import { useToastStore } from './toast'
import { useUiStore } from './ui'

type AppScreen = 'startup' | 'main'

interface RepositoryState {
  screen: AppScreen
  loading: boolean
  refreshing: boolean
  branchSwitching: boolean
  repository: Repository | null
  commits: Commit[]
  commitPage: CommitPageInfo
  loadingMoreCommits: boolean
  branches: Branch[]
  tags: Tag[]
  stashes: Stash[]
  worktrees: Worktree[]
  workingTree: WorkingTreeFile[]
  layout: GraphLayout
  operation: string | null
  operationPhase: string | null
  busyAction: string | null
  canCancel: boolean
  commitMessage: string
  commitDescription: string
  signOff: boolean
  recentRepos: RecentRepository[]
  selectedFilePath: string | null
  commitFiles: WorkingTreeFile[]
  commitFilesLoading: boolean
  diff: DiffResult | null
  diffLoading: boolean
  searchOpen: boolean
}

const EMPTY_LAYOUT: GraphLayout = { nodes: [], bands: [], maxLanes: 1 }
const EMPTY_PAGE: CommitPageInfo = { oldestSha: null, hasMore: false, total: null }

let changeUnsub: (() => void) | null = null
let progressUnsub: (() => void) | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let pendingRefreshScopes: SnapshotScope[] | undefined
let pendingFullRefresh = false

function graphSnapshotOptions(
  extra?: Pick<SnapshotOptions, 'invalidateCommits'>,
): SnapshotRefreshOptions {
  const ui = useUiStore()
  return {
    graphScope: ui.graphScope,
    commitLimit: ui.clampedCommitGraphLimit,
    ...extra,
  }
}

export const useRepositoryStore = defineStore('repository', {
  state: (): RepositoryState => ({
    screen: 'startup',
    loading: false,
    refreshing: false,
    branchSwitching: false,
    repository: null,
    commits: [],
    commitPage: { ...EMPTY_PAGE },
    loadingMoreCommits: false,
    branches: [],
    tags: [],
    stashes: [],
    worktrees: [],
    workingTree: [],
    layout: EMPTY_LAYOUT,
    operation: null,
    operationPhase: null,
    busyAction: null,
    canCancel: false,
    commitMessage: '',
    commitDescription: '',
    signOff: false,
    recentRepos: [],
    selectedFilePath: null,
    commitFiles: [],
    commitFilesLoading: false,
    diff: null,
    diffLoading: false,
    searchOpen: false,
  }),
  getters: {
    localBranches: (state): Branch[] => state.branches.filter((b) => b.kind === 'local'),
    remoteBranches: (state): Branch[] => state.branches.filter((b) => b.kind === 'remote'),
    favoriteBranches: (state): Branch[] => state.branches.filter((b) => b.isFavorite),
    currentBranch: (state): Branch | undefined => state.branches.find((b) => b.isCurrent),
    stagedFiles: (state): WorkingTreeFile[] => state.workingTree.filter((f) => f.staged),
    unstagedFiles: (state): WorkingTreeFile[] =>
      state.workingTree.filter((f) => !f.staged && f.status !== 'conflicted'),
    conflictedFiles: (state): WorkingTreeFile[] =>
      state.workingTree.filter((f) => f.status === 'conflicted'),
    canCommit(state): boolean {
      return state.commitMessage.trim().length > 0 && this.stagedFiles.length > 0
    },
    hasOpenRepo: (state): boolean => state.repository != null,
    repoState: (state) => state.repository?.state,
    inProgressOperation(state): boolean {
      const s = state.repository?.state
      if (!s) return false
      return s.merging || s.rebasing || s.cherryPicking || s.reverting
    },
  },
  actions: {
    async init(): Promise<void> {
      this.recentRepos = await gitService.recentRepos()
      changeUnsub?.()
      progressUnsub?.()
      changeUnsub = gitService.onRepositoryChanged((event) => {
        this.scheduleRefresh(event.scopes)
      })
      progressUnsub = gitService.onProgress((progress) => this.onProgress(progress))
    },

    scheduleRefresh(scopes?: SnapshotScope[]): void {
      if (refreshTimer) clearTimeout(refreshTimer)
      if (scopes === undefined) {
        pendingFullRefresh = true
      } else if (!pendingFullRefresh) {
        pendingRefreshScopes = [...new Set([...(pendingRefreshScopes ?? []), ...scopes])]
      }
      refreshTimer = setTimeout(() => {
        const merged = pendingFullRefresh ? undefined : pendingRefreshScopes
        pendingRefreshScopes = undefined
        pendingFullRefresh = false
        void this.refreshSnapshot(merged)
      }, 150)
    },

    onProgress(progress: OperationProgress): void {
      if (progress.done) {
        this.operationPhase = null
        this.canCancel = false
        return
      }
      this.operationPhase = progress.phase
      this.canCancel = true
    },

    async cancelOperation(): Promise<void> {
      await gitService.cancelActiveOperation()
      this.operation = null
      this.operationPhase = null
      this.busyAction = null
      this.branchSwitching = false
      this.refreshing = false
      this.canCancel = false
    },

    applySnapshot(data: RepositoryData, page?: CommitPageInfo): void {
      this.repository = data.repository
      this.commits = data.commits
      this.branches = data.branches
      this.tags = data.tags
      this.stashes = data.stashes
      this.worktrees = data.worktrees
      this.workingTree = data.workingTree
      this.commitPage = page ?? gitService.commitPage ?? { ...EMPTY_PAGE }
      this.layout = computeGraphLayout(this.commits)
    },

    async openRepository(path: string, options?: { silent?: boolean }): Promise<boolean> {
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

    async pickAndOpenRepository(): Promise<boolean> {
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

    async closeRepository(): Promise<void> {
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
      this.selectedFilePath = null
      this.commitFiles = []
      this.diff = null
      this.screen = 'startup'
      this.recentRepos = await gitService.recentRepos()
    },

    async refreshSnapshot(
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
            this.layout = computeGraphLayout(this.commits)
          }
          if (scopes.includes('branches')) this.branches = data.branches
          if (scopes.includes('tags')) this.tags = data.tags
          if (scopes.includes('stashes')) this.stashes = data.stashes
          if (scopes.includes('worktrees')) this.worktrees = data.worktrees
          if (scopes.includes('status')) this.workingTree = data.workingTree
        }
        if (this.selectedFilePath) void this.loadDiff(this.selectedFilePath)
      } catch {
        /* no repo open */
      }
    },

    async loadMoreCommits(): Promise<void> {
      /* pagination removed — graph loads a fixed recent window */
    },

    async removeRecent(path: string): Promise<void> {
      this.recentRepos = await gitService.removeRecent(path)
    },

    async loadMock(): Promise<void> {
      if (!gitService.load) return
      this.loading = true
      const data = await gitService.load()
      this.applySnapshot(data)
      this.screen = 'main'
      this.loading = false
    },

    async runAction(action: GitAction, options?: { skipConfirm?: boolean }): Promise<boolean> {
      if (!options?.skipConfirm && isDestructiveAction(action.kind)) {
        const ok = await usePromptStore().confirm({
          title: 'Confirm destructive action',
          message: describeAction(action),
          confirmLabel: 'Continue',
          danger: true,
        })
        if (!ok) return false
      }

      if (action.kind === 'open-terminal') {
        const opened = await gitService.openTerminal(this.repository?.path)
        useToastStore().push(opened ? 'Opened terminal' : 'Could not open terminal', opened ? 'success' : 'error')
        return opened
      }

      if (action.kind === 'reveal-in-finder' && action.target && this.repository) {
        const full = action.target.startsWith('/')
          ? action.target
          : `${this.repository.path}/${action.target}`
        await gitService.revealPath(full)
        return true
      }

      if (action.kind === 'refresh') {
        this.busyAction = 'refresh'
        this.operation = 'Refreshing...'
        this.refreshing = true
        try {
          await this.refreshSnapshot(undefined, { invalidateCommits: true })
        } finally {
          this.refreshing = false
          this.busyAction = null
          this.operation = null
        }
        useToastStore().push('Refreshed repository', 'success')
        return true
      }

      const toast = useToastStore()
      const switchingBranch = isBranchSwitchAction(action.kind)
      this.busyAction = action.kind
      this.operation = labelForOperation(action)
      this.branchSwitching = switchingBranch
      this.canCancel = ['fetch', 'pull', 'push', 'force-push', 'sync', 'fetch-all'].includes(action.kind)

      const result = await gitService.execute(action)

      toast.push(result.message, result.ok ? 'success' : 'error')
      if (result.ok) {
        this.refreshing = true
        try {
          await this.refreshSnapshot(scopesForAction(action.kind))
        } finally {
          this.refreshing = false
        }
        if (switchingBranch) {
          useSelectionStore().select(this.commits[0]?.sha ?? null)
          this.selectedFilePath = null
          this.diff = null
        }
      } else if (this.inProgressOperation) {
        await this.refreshSnapshot(['status', 'branches'])
      }

      this.operation = null
      this.operationPhase = null
      this.busyAction = null
      this.branchSwitching = false
      this.canCancel = false
      return result.ok
    },

    async createBranch(startPoint?: string): Promise<void> {
      const name = await usePromptStore().prompt({
        title: 'Create Branch',
        message: startPoint ? `Branch from ${startPoint}` : 'Enter a name for the new branch',
        placeholder: 'feature/my-branch',
      })
      if (!name) return
      await this.runAction({ kind: 'create-branch', meta: { name, startPoint } })
    },

    async renameBranch(branchName: string): Promise<void> {
      const newName = await usePromptStore().prompt({
        title: 'Rename Branch',
        message: `Rename ${branchName}`,
        defaultValue: branchName,
      })
      if (!newName || newName === branchName) return
      await this.runAction({ kind: 'rename-branch', target: branchName, meta: { newName } })
    },

    async deleteBranch(branchName: string, force = false): Promise<void> {
      await this.runAction({ kind: 'delete-branch', target: branchName, meta: { force } })
    },

    async setUpstream(branchName: string): Promise<void> {
      const upstream = await usePromptStore().prompt({
        title: 'Set Upstream',
        message: `Upstream for ${branchName}`,
        placeholder: 'origin/main',
      })
      if (!upstream) return
      await this.runAction({ kind: 'set-upstream', target: upstream })
    },

    async mergeBranch(): Promise<void> {
      const target = await usePromptStore().prompt({
        title: 'Merge Branch',
        message: 'Branch to merge into the current branch',
        placeholder: 'feature/my-branch',
      })
      if (!target) return
      await this.runAction({ kind: 'merge', target })
    },

    async rebaseOnto(): Promise<void> {
      const target = await usePromptStore().prompt({
        title: 'Rebase',
        message: 'Rebase current branch onto',
        placeholder: 'main',
      })
      if (!target) return
      await this.runAction({ kind: 'rebase', target })
    },

    async cherryPickCommit(sha?: string): Promise<void> {
      const target =
        sha ??
        (await usePromptStore().prompt({
          title: 'Cherry Pick',
          message: 'Commit SHA to cherry-pick',
          placeholder: 'abc1234',
        }))
      if (!target) return
      await this.runAction({ kind: 'cherry-pick', target })
    },

    async resetTo(mode: 'reset-soft' | 'reset-mixed' | 'reset-hard', sha?: string): Promise<void> {
      const target =
        sha ??
        (await usePromptStore().prompt({
          title: 'Reset',
          message: 'Commit to reset to (leave empty for HEAD)',
          placeholder: 'HEAD~1',
        }))
      await this.runAction({ kind: mode, target: target || 'HEAD' })
    },

    async stashChanges(): Promise<void> {
      const message = await usePromptStore().prompt({
        title: 'Stash Changes',
        message: 'Optional stash message',
        defaultValue: 'WIP',
      })
      if (message === null) return
      await this.runAction({ kind: 'stash', meta: { message: message || 'WIP' } })
    },

    async createTag(): Promise<void> {
      const name = await usePromptStore().prompt({
        title: 'Create Tag',
        message: 'Tag name',
        placeholder: 'v1.0.0',
      })
      if (!name) return
      const message = await usePromptStore().prompt({
        title: 'Tag Message',
        message: 'Annotated tag message (optional)',
        placeholder: name,
      })
      await this.runAction({
        kind: 'create-tag',
        meta: { name, message: message ?? name, annotated: Boolean(message) },
      })
    },

    async continueOperation(): Promise<void> {
      const s = this.repoState
      if (s?.merging) await this.runAction({ kind: 'merge-continue' }, { skipConfirm: true })
      else if (s?.rebasing) await this.runAction({ kind: 'rebase-continue' }, { skipConfirm: true })
      else if (s?.cherryPicking) await this.runAction({ kind: 'cherry-pick-continue' }, { skipConfirm: true })
      else if (s?.reverting) await this.runAction({ kind: 'revert-continue' }, { skipConfirm: true })
    },

    async abortOperation(): Promise<void> {
      const s = this.repoState
      if (s?.merging) await this.runAction({ kind: 'merge-abort' }, { skipConfirm: true })
      else if (s?.rebasing) await this.runAction({ kind: 'rebase-abort' }, { skipConfirm: true })
      else if (s?.cherryPicking) await this.runAction({ kind: 'cherry-pick-abort' }, { skipConfirm: true })
      else if (s?.reverting) await this.runAction({ kind: 'revert-abort' }, { skipConfirm: true })
    },

    toggleFavorite(branchId: string): void {
      const branch = this.branches.find((b) => b.id === branchId)
      if (!branch || !this.repository) return
      branch.isFavorite = !branch.isFavorite
      const key = `branch-favorites:${this.repository.path}`
      const favorites = this.branches.filter((b) => b.isFavorite).map((b) => b.name)
      void window.electron?.store.set(key, favorites)
    },

    checkoutBranch(name: string): void {
      void this.runAction({ kind: 'checkout', target: name })
    },

    checkoutRemoteBranch(branch: Branch): void {
      const localName = branch.name.includes('/') ? branch.name.split('/').slice(1).join('/') : branch.name
      void this.runAction({ kind: 'checkout', target: localName, meta: { remote: branch.remote } })
    },

    toggleStaged(fileId: string): void {
      const file = this.workingTree.find((f) => f.id === fileId)
      if (!file) return
      void this.runAction({ kind: file.staged ? 'unstage' : 'stage', target: file.path })
    },

    selectFile(path: string | null): void {
      this.selectedFilePath = path
      if (path) void this.loadDiff(path)
      else this.diff = null
    },

    async loadCommitFiles(sha: string): Promise<void> {
      this.commitFilesLoading = true
      this.selectedFilePath = null
      this.diff = null
      try {
        this.commitFiles = await gitService.getCommitFiles(sha)
      } catch (error) {
        this.commitFiles = []
        const detail = error instanceof Error ? error.message : String(error)
        useToastStore().push(`Could not load commit files: ${detail}`, 'error')
      } finally {
        this.commitFilesLoading = false
      }
    },

    clearCommitFiles(): void {
      this.commitFiles = []
      this.commitFilesLoading = false
      this.selectedFilePath = null
      this.diff = null
    },

    async loadDiff(path: string): Promise<void> {
      const file = this.workingTree.find((f) => f.path === path)
      const commitSha = useSelectionStore().selectedSha
      this.diffLoading = true
      try {
        this.diff = await gitService.getDiff(
          commitSha
            ? { path, source: 'commit', sha: commitSha }
            : {
                path,
                source: file?.staged ? 'index' : 'worktree',
              },
        )
      } catch {
        this.diff = null
      } finally {
        this.diffLoading = false
      }
    },

    stageAll(): void {
      void this.runAction({ kind: 'stage-all' })
    },

    unstageAll(): void {
      void this.runAction({ kind: 'unstage-all' })
    },

    async commit(thenPush = false): Promise<void> {
      if (!this.canCommit) return
      await this.runAction({
        kind: thenPush ? 'commit-and-push' : 'commit',
        meta: {
          message: this.commitMessage,
          body: this.commitDescription,
          signOff: this.signOff,
        },
      })
      this.commitMessage = ''
      this.commitDescription = ''
    },

    openSearch(): void {
      this.searchOpen = true
    },

    closeSearch(): void {
      this.searchOpen = false
    },
  },
})

function describeAction(action: GitAction): string {
  const target = action.target ? ` "${action.target}"` : ''
  return `Are you sure you want to run ${action.kind}${target}? This cannot be undone.`
}

function isBranchSwitchAction(kind: GitAction['kind']): boolean {
  return kind === 'checkout' || kind === 'checkout-commit' || kind === 'checkout-tag'
}

function labelForOperation(action: GitAction): string | null {
  switch (action.kind) {
    case 'fetch':
    case 'fetch-all':
      return 'Fetching...'
    case 'pull':
      return 'Pulling...'
    case 'push':
    case 'force-push':
      return 'Pushing...'
    case 'sync':
      return 'Syncing...'
    case 'commit-and-push':
      return 'Committing and pushing...'
    case 'rebase':
    case 'interactive-rebase':
    case 'rebase-from-here':
      return 'Rebasing...'
    case 'merge':
      return 'Merging...'
    case 'checkout':
      return `Switching to ${action.target ?? 'branch'}...`
    case 'checkout-commit':
      return 'Checking out commit...'
    case 'checkout-tag':
      return `Checking out ${action.target ?? 'tag'}...`
    default:
      return null
  }
}

function scopesForAction(kind: GitAction['kind']): SnapshotScope[] | undefined {
  if (kind.startsWith('reset') || kind.includes('rebase') || kind.includes('merge') || kind.includes('cherry')) {
    return ['commits', 'branches', 'status']
  }
  if (kind.includes('branch') || kind === 'checkout' || kind === 'checkout-commit' || kind === 'checkout-tag') {
    return ['commits', 'branches', 'status']
  }
  if (kind === 'commit' || kind === 'commit-and-push') {
    return ['commits', 'status']
  }
  if (kind.includes('stage') || kind === 'stash' || kind.includes('discard')) {
    return ['status']
  }
  if (kind === 'fetch' || kind === 'pull' || kind === 'push' || kind === 'sync' || kind === 'fetch-all') {
    return ['branches', 'commits', 'status']
  }
  if (kind === 'create-tag' || kind === 'delete-tag' || kind === 'tag') return ['tags', 'commits']
  if (kind.includes('stash')) return ['stashes', 'status']
  if (kind === 'refresh') return undefined
  return ['status', 'branches']
}
