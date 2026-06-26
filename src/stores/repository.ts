import { defineStore } from 'pinia'
import type { CommitPageInfo, OperationProgress, RecentRepository, SnapshotOptions, SnapshotScope } from '@shared/git/models'
import { credentialHintFor } from '@shared/git/credentialHints'
import type {
  Author,
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
import type { SnapshotRefreshOptions } from '@/lib/git/GitService'
import { gitService } from '@/lib/git'
import { isDestructiveAction } from '@/lib/git/destructive'
import { buildGraphLayout, EMPTY_LAYOUT, EMPTY_PAGE } from './repo/graphLayout'
import {
  describeAction,
  isBranchSwitchAction,
  labelForOperation,
  scopesForAction,
} from './repo/actionHelpers'
import { useRepoDiffStore } from './repoDiff'
import { usePromptStore } from './prompt'
import { useSelectionStore } from './selection'
import { useToastStore } from './toast'
import { useUiStore } from './ui'
import type { GraphLayout } from '@/lib/graph/computeGraphLayout'

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
  amend: boolean
  recentRepos: RecentRepository[]
  searchOpen: boolean
  commitAuthor: Author | null
}

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
    amend: false,
    recentRepos: [],
    searchOpen: false,
    commitAuthor: null,
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
    hasPendingChanges(): boolean {
      return (
        this.unstagedFiles.length > 0 ||
        this.stagedFiles.length > 0 ||
        this.conflictedFiles.length > 0
      )
    },
    headCommitIndex(state): number {
      const headSha = state.repository?.headSha
      if (headSha) {
        const bySha = state.commits.findIndex((c) => c.sha === headSha)
        if (bySha >= 0) return bySha
      }
      return state.commits.findIndex((c) => c.refs.some((r) => r.isHead))
    },
    hasUnresolvedConflicts(): boolean {
      return this.conflictedFiles.length > 0
    },
    canCommit(state): boolean {
      const hasMessage = state.commitMessage.trim().length > 0
      if (state.amend) return hasMessage
      return hasMessage && this.stagedFiles.length > 0
    },
    hasOpenRepo: (state): boolean => state.repository != null,
    repoState: (state) => state.repository?.state,
    inProgressOperation(state): boolean {
      const s = state.repository?.state
      if (!s) return false
      return s.merging || s.rebasing || s.cherryPicking || s.reverting
    },
    canUndo(state): boolean {
      return !!(
        state.repository?.canUndo &&
        !state.busyAction &&
        !state.refreshing &&
        !this.inProgressOperation
      )
    },
    canRedo(state): boolean {
      return !!(
        state.repository?.canRedo &&
        !state.busyAction &&
        !state.refreshing &&
        !this.inProgressOperation
      )
    },
    undoTooltip(state): string {
      const label = state.repository?.undoLabel
      return label ? `Undo ${label}` : 'Undo'
    },
    redoTooltip(state): string {
      const label = state.repository?.redoLabel
      return label ? `Redo ${label}` : 'Redo'
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
      this.commitAuthor = data.commitAuthor
      this.commitPage = page ?? gitService.commitPage ?? { ...EMPTY_PAGE }
      this.layout = buildGraphLayout(this.commits, this.headCommitIndex)
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
      useRepoDiffStore().resetOnRepoClose()
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
            this.layout = buildGraphLayout(this.commits, this.headCommitIndex)
          }
          if (scopes.includes('branches')) this.branches = data.branches
          if (scopes.includes('tags')) this.tags = data.tags
          if (scopes.includes('stashes')) this.stashes = data.stashes
          if (scopes.includes('worktrees')) this.worktrees = data.worktrees
          if (scopes.includes('status')) this.workingTree = data.workingTree
        }
        const diffStore = useRepoDiffStore()
        if (diffStore.selectedFilePath) {
          if (diffStore.selectedFileIsConflicted) void diffStore.loadConflict(diffStore.selectedFilePath)
          else void diffStore.loadDiff(diffStore.selectedFilePath)
        }
      } catch {
        /* no repo open */
      }
    },

    async loadMoreCommits(): Promise<void> {
      const oldestSha = this.commitPage.oldestSha
      if (!oldestSha || !this.commitPage.hasMore || this.loadingMoreCommits) return

      this.loadingMoreCommits = true
      try {
        const ui = useUiStore()
        const result = await gitService.loadMoreCommits({
          beforeSha: oldestSha,
          limit: ui.clampedCommitGraphLimit,
          graphScope: ui.graphScope,
        })
        if (result.commits.length === 0) {
          this.commitPage = { ...this.commitPage, hasMore: false }
          return
        }
        const existing = new Set(this.commits.map((c) => c.sha))
        const newCommits = result.commits.filter((c) => !existing.has(c.sha))
        this.commits = [...this.commits, ...newCommits]
        this.commitPage = result.page
        this.layout = buildGraphLayout(this.commits, this.headCommitIndex)
      } finally {
        this.loadingMoreCommits = false
      }
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
      this.canCancel = ['fetch', 'pull', 'push', 'force-push', 'commit-and-force-push', 'sync', 'fetch-all'].includes(action.kind)

      const result = await gitService.execute(action)

      const hint = !result.ok && result.errorCode ? credentialHintFor(result.errorCode) : undefined
      const toastMessage = hint ? `${result.message} — ${hint}` : result.message
      toast.push(toastMessage, result.ok ? 'success' : 'error')
      if (result.ok) {
        this.refreshing = true
        try {
          await this.refreshSnapshot(scopesForAction(action.kind))
        } finally {
          this.refreshing = false
        }
        if (switchingBranch) {
          useSelectionStore().select(this.commits[0]?.sha ?? null)
          useRepoDiffStore().resetOnRepoClose()
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

    async integrateBranches(
      source: Branch,
      target: Branch,
      mode: 'merge' | 'rebase',
    ): Promise<void> {
      if (source.id === target.id) return

      if (this.busyAction || this.inProgressOperation) {
        useToastStore().push('Finish the current operation first', 'error')
        return
      }

      if (mode === 'merge') {
        if (!target.isCurrent) {
          const switched = await this.checkoutBranchForIntegrate(target)
          if (!switched) return
        }
        await this.runAction({ kind: 'merge', target: source.name })
        return
      }

      if (!source.isCurrent) {
        const switched = await this.checkoutBranchForIntegrate(source)
        if (!switched) return
      }
      await this.runAction({ kind: 'rebase', target: target.name })
    },

    async checkoutBranchForIntegrate(branch: Branch): Promise<boolean> {
      if (branch.kind === 'remote') {
        const localName = branch.name.includes('/')
          ? branch.name.split('/').slice(1).join('/')
          : branch.name
        return this.runAction({
          kind: 'checkout',
          target: localName,
          meta: { remote: branch.remote },
        })
      }
      return this.runAction({ kind: 'checkout', target: branch.name })
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

    async skipRebaseOperation(): Promise<void> {
      if (!this.repoState?.rebasing) return
      await this.runAction({ kind: 'rebase-skip' }, { skipConfirm: true })
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

    async resolveConflictOurs(path: string): Promise<void> {
      await this.runAction({ kind: 'resolve-conflict-ours', target: path }, { skipConfirm: true })
      await useRepoDiffStore().afterConflictAction(path)
    },

    async resolveConflictTheirs(path: string): Promise<void> {
      await this.runAction({ kind: 'resolve-conflict-theirs', target: path }, { skipConfirm: true })
      await useRepoDiffStore().afterConflictAction(path)
    },

    async resolveConflictBlock(path: string, blockIndex: number, side: 'ours' | 'theirs'): Promise<void> {
      await this.runAction(
        { kind: 'resolve-conflict-block', target: path, meta: { blockIndex, side } },
        { skipConfirm: true },
      )
      await useRepoDiffStore().afterConflictAction(path)
    },

    async markConflictResolved(path: string): Promise<void> {
      await this.runAction({ kind: 'mark-conflict-resolved', target: path }, { skipConfirm: true })
      await useRepoDiffStore().afterConflictAction(path)
    },

    stageAll(): void {
      void this.runAction({ kind: 'stage-all' })
    },

    unstageAll(): void {
      void this.runAction({ kind: 'unstage-all' })
    },

    async discardAllChanges(): Promise<void> {
      if (this.workingTree.length === 0) return
      if (this.stagedFiles.length > 0) {
        const ok = await this.runAction({ kind: 'unstage-all' }, { skipConfirm: true })
        if (!ok) return
      }
      await this.runAction({ kind: 'discard-all' })
    },

    async commit(options: { thenPush?: boolean; forcePush?: boolean } = {}): Promise<void> {
      if (!this.canCommit) return
      const { thenPush = false, forcePush = false } = options

      let kind: GitAction['kind']
      if (thenPush && forcePush) {
        kind = 'commit-and-force-push'
      } else if (thenPush) {
        kind = 'commit-and-push'
      } else {
        kind = this.amend ? 'amend' : 'commit'
      }

      await this.runAction({
        kind,
        meta: {
          message: this.commitMessage,
          body: this.commitDescription,
          signOff: this.signOff,
          amend: this.amend,
        },
      })
      this.commitMessage = ''
      this.commitDescription = ''
      this.amend = false
    },

    openSearch(): void {
      this.searchOpen = true
    },

    closeSearch(): void {
      this.searchOpen = false
    },
  },
})
