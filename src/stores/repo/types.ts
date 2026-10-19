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

export type AppScreen = 'restoring' | 'startup' | 'main'

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
  /**
   * A switch whose first paint is expected to block the main thread (a cached
   * tab with thousands of sidebar rows). The loading skeleton shows for these
   * without waiting out the anti-flicker delay: the paint that covers the
   * outgoing repository happens after the skeleton has been drawn, so the user
   * sees a loading state instead of a frozen screen.
   */
  pendingRepoHeavy: boolean
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
