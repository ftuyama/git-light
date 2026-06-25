import { defineStore } from 'pinia'
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
import { gitService } from '@/lib/git/MockGitService'
import { useToastStore } from './toast'

interface RepositoryState {
  loading: boolean
  repository: Repository | null
  commits: Commit[]
  branches: Branch[]
  tags: Tag[]
  stashes: Stash[]
  worktrees: Worktree[]
  workingTree: WorkingTreeFile[]
  layout: GraphLayout
  operation: string | null
  busyAction: string | null
  commitMessage: string
  commitDescription: string
  signOff: boolean
  recentBranches: string[]
}

const EMPTY_LAYOUT: GraphLayout = { nodes: [], bands: [], maxLanes: 1 }

export const useRepositoryStore = defineStore('repository', {
  state: (): RepositoryState => ({
    loading: true,
    repository: null,
    commits: [],
    branches: [],
    tags: [],
    stashes: [],
    worktrees: [],
    workingTree: [],
    layout: EMPTY_LAYOUT,
    operation: null,
    busyAction: null,
    commitMessage: '',
    commitDescription: '',
    signOff: false,
    recentBranches: ['feature/payment', 'develop', 'main', 'release/2.5'],
  }),
  getters: {
    localBranches: (state): Branch[] => state.branches.filter((b) => b.kind === 'local'),
    remoteBranches: (state): Branch[] => state.branches.filter((b) => b.kind === 'remote'),
    favoriteBranches: (state): Branch[] => state.branches.filter((b) => b.isFavorite),
    currentBranch: (state): Branch | undefined =>
      state.branches.find((b) => b.isCurrent),
    stagedFiles: (state): WorkingTreeFile[] => state.workingTree.filter((f) => f.staged),
    unstagedFiles: (state): WorkingTreeFile[] =>
      state.workingTree.filter((f) => !f.staged && f.status !== 'conflicted'),
    conflictedFiles: (state): WorkingTreeFile[] =>
      state.workingTree.filter((f) => f.status === 'conflicted'),
    canCommit(state): boolean {
      return state.commitMessage.trim().length > 0 && this.stagedFiles.length > 0
    },
  },
  actions: {
    async load(): Promise<void> {
      this.loading = true
      const data: RepositoryData = await gitService.load()
      this.repository = data.repository
      this.commits = data.commits
      this.branches = data.branches
      this.tags = data.tags
      this.stashes = data.stashes
      this.worktrees = data.worktrees
      this.workingTree = data.workingTree
      this.layout = computeGraphLayout(data.commits)
      this.loading = false
    },

    async runAction(action: GitAction): Promise<void> {
      const toast = useToastStore()
      this.busyAction = action.kind
      this.operation = labelForOperation(action)
      const result = await gitService.execute(action)
      this.operation = null
      this.busyAction = null
      toast.push(result.message, result.ok ? 'success' : 'error')
    },

    toggleFavorite(branchId: string): void {
      const branch = this.branches.find((b) => b.id === branchId)
      if (branch) branch.isFavorite = !branch.isFavorite
    },

    checkoutBranch(name: string): void {
      this.branches.forEach((b) => {
        b.isCurrent = b.kind === 'local' && b.name === name
      })
      if (this.repository) this.repository.currentBranch = name
      this.recentBranches = [name, ...this.recentBranches.filter((b) => b !== name)].slice(0, 6)
      void this.runAction({ kind: 'checkout', target: name })
    },

    toggleStaged(fileId: string): void {
      const file = this.workingTree.find((f) => f.id === fileId)
      if (file) file.staged = !file.staged
    },

    stageAll(): void {
      this.workingTree.forEach((f) => {
        if (f.status !== 'conflicted') f.staged = true
      })
      void this.runAction({ kind: 'stage-all' })
    },

    unstageAll(): void {
      this.workingTree.forEach((f) => (f.staged = false))
      void this.runAction({ kind: 'unstage-all' })
    },

    async commit(thenPush = false): Promise<void> {
      if (!this.canCommit) return
      await this.runAction({
        kind: thenPush ? 'commit-and-push' : 'commit',
        meta: { message: this.commitMessage },
      })
      this.workingTree = this.workingTree.filter((f) => !f.staged)
      this.commitMessage = ''
      this.commitDescription = ''
    },
  },
})

function labelForOperation(action: GitAction): string | null {
  switch (action.kind) {
    case 'fetch':
      return 'Fetching origin...'
    case 'pull':
      return 'Pulling from origin...'
    case 'push':
    case 'force-push':
      return 'Pushing to origin...'
    case 'sync':
      return 'Syncing with origin...'
    case 'commit-and-push':
      return 'Committing and pushing...'
    case 'rebase':
    case 'interactive-rebase':
    case 'rebase-from-here':
      return 'Rebasing...'
    case 'merge':
      return 'Merging...'
    default:
      return null
  }
}
