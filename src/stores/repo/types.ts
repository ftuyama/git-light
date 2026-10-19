import type { CommitPageInfo, RecentRepository } from '@shared/git/models'
import type {
  Author,
  Branch,
  Commit,
  Repository,
  Stash,
  Tag,
  WorkingTreeFile,
  Worktree,
} from '@/types/git'
import type { GraphLayout } from '@/lib/graph/computeGraphLayout'

export type AppScreen = 'startup' | 'main'

export interface RepositoryState {
  screen: AppScreen
  loading: boolean
  /**
   * Repository a switch is loading right now. A cold tab switch leaves the
   * outgoing repository in `repository` until its snapshot lands, which would
   * show the wrong repo for the whole round-trip; the UI renders a loading
   * skeleton while this is set instead. Null when no switch is in flight (a
   * first open stays on StartupView, which has its own busy state).
   */
  pendingRepoPath: string | null
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
  amend: boolean
  preAmendDraft: { message: string; description: string } | null
  recentRepos: RecentRepository[]
  searchOpen: boolean
  commitAuthor: Author | null
}
