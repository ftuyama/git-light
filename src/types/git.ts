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
}

export interface Tag {
  id: string
  name: string
  sha: string
  message: string
  date: Date
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

export type FileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'conflicted'

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
}

export interface Repository {
  name: string
  path: string
  gitVersion: string
  currentBranch: string
  ahead: number
  behind: number
  remoteUrl: string
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
}

export type GitActionKind =
  | 'fetch'
  | 'pull'
  | 'push'
  | 'force-push'
  | 'sync'
  | 'stash'
  | 'pop-stash'
  | 'apply-stash'
  | 'drop-stash'
  | 'cherry-pick'
  | 'merge'
  | 'rebase'
  | 'interactive-rebase'
  | 'reset-soft'
  | 'reset-mixed'
  | 'reset-hard'
  | 'revert'
  | 'undo'
  | 'redo'
  | 'refresh'
  | 'open-terminal'
  | 'checkout'
  | 'create-branch'
  | 'delete-branch'
  | 'rename-branch'
  | 'compare-branches'
  | 'tag'
  | 'copy-sha'
  | 'open-on-github'
  | 'rebase-from-here'
  | 'stage-all'
  | 'unstage-all'
  | 'stage'
  | 'unstage'
  | 'commit'
  | 'commit-and-push'

export interface GitAction {
  kind: GitActionKind
  target?: string
  meta?: Record<string, unknown>
}

export interface ActionResult {
  ok: boolean
  message: string
}
