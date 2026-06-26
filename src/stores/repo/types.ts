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
