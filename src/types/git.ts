import type { RepoState } from '@shared/git/models'

export type { GitAction, GitActionKind, ActionResult } from '@shared/git/actions'
export type { RepoState } from '@shared/git/models'

export interface Author {
  name: string
  email: string
  avatarUrl: string
  initials: string
  color: string
}

export type RefType = 'head' | 'localBranch' | 'remoteBranch' | 'tag' | 'stash'

export interface Ref {
  type: RefType
  name: string
  /** Short display name, e.g. "feature/payment" or "origin/main". */
  label: string
  isHead?: boolean
}

export interface Commit {
  sha: string
  shortSha: string
  parents: string[]
  subject: string
  body?: string
  author: Author
  committer: Author
  date: Date
  refs: Ref[]
  isMerge: boolean
  isCherryPick?: boolean
}

export type BranchKind = 'local' | 'remote'

export interface Branch {
  id: string
  name: string
  kind: BranchKind
  /** Grouping prefix, e.g. "feature", "release", "hotfix", or "" for root. */
  group: string
  remote?: string
  tipSha: string
  ahead: number
  behind: number
  isCurrent: boolean
  isFavorite: boolean
  lastActivity: Date
  laneColorIndex: number
  upstream?: string
}

export interface Tag {
  id: string
  name: string
  sha: string
  message: string
  date: Date
  annotated?: boolean
}

export interface Stash {
  id: string
  index: number
  message: string
  branch: string
  date: Date
  filesChanged: number
}

export interface Worktree {
  id: string
  path: string
  branch: string
  isMain: boolean
  isLocked: boolean
}

export type FileStatus =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'ignored'
  | 'conflicted'

export interface WorkingTreeFile {
  id: string
  path: string
  fileName: string
  directory: string
  status: FileStatus
  staged: boolean
  additions: number
  deletions: number
  oldPath?: string
  isSubmodule?: boolean
}

export interface Remote {
  name: string
  fetchUrl: string
  pushUrl: string
}

export interface Repository {
  name: string
  path: string
  gitVersion: string
  currentBranch: string
  ahead: number
  behind: number
  remoteUrl: string
  detached?: boolean
  headSha?: string
  remotes?: Remote[]
  state?: RepoState
  canUndo?: boolean
  canRedo?: boolean
  undoLabel?: string | null
  redoLabel?: string | null
}

export interface RepositoryData {
  repository: Repository
  commits: Commit[]
  branches: Branch[]
  tags: Tag[]
  stashes: Stash[]
  worktrees: Worktree[]
  workingTree: WorkingTreeFile[]
  authors: Author[]
  /** Git `user.name` / `user.email` for the next commit. */
  commitAuthor: Author
}

/** Commit-graph pagination state surfaced to the store/UI. */
export interface CommitPageInfo {
  oldestSha: string | null
  hasMore: boolean
  total: number | null
}
