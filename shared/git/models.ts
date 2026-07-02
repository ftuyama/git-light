/**
 * Wire models exchanged over IPC. These mirror the renderer domain types in
 * `src/types/git.ts` but use ISO-8601 string dates so the payload is trivially
 * serializable and unambiguous across the process boundary. `IpcGitService`
 * revives the strings into `Date` objects for the UI layer.
 */

export interface WireAuthor {
  name: string
  email: string
  avatarUrl: string
  initials: string
  color: string
}

export type WireRefType = 'head' | 'localBranch' | 'remoteBranch' | 'tag' | 'stash'

export interface WireRef {
  type: WireRefType
  name: string
  label: string
  isHead?: boolean
}

export interface WireCommit {
  sha: string
  shortSha: string
  parents: string[]
  subject: string
  body?: string
  author: WireAuthor
  committer: WireAuthor
  date: string
  refs: WireRef[]
  isMerge: boolean
  isCherryPick?: boolean
}

export type WireBranchKind = 'local' | 'remote'

export interface WireBranch {
  id: string
  name: string
  kind: WireBranchKind
  group: string
  remote?: string
  tipSha: string
  ahead: number
  behind: number
  isCurrent: boolean
  isFavorite: boolean
  lastActivity: string
  laneColorIndex: number
  upstream?: string
}

export interface WireTag {
  id: string
  name: string
  sha: string
  message: string
  date: string
  annotated: boolean
}

export interface WireStash {
  id: string
  index: number
  message: string
  branch: string
  date: string
  filesChanged: number
}

export interface WireWorktree {
  id: string
  path: string
  branch: string
  isMain: boolean
  isLocked: boolean
}

export type WireFileStatus =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'ignored'
  | 'conflicted'

export interface WireWorkingTreeFile {
  id: string
  path: string
  fileName: string
  directory: string
  status: WireFileStatus
  staged: boolean
  additions: number
  deletions: number
  oldPath?: string
  isSubmodule?: boolean
}

/** In-progress git operation detected from the `.git` directory. */
export interface RepoState {
  detachedHead: boolean
  merging: boolean
  rebasing: boolean
  cherryPicking: boolean
  reverting: boolean
  bisecting: boolean
  /** Short label for the status bar, e.g. "REBASING (2/5)". */
  operationLabel: string | null
}

export interface WireRepository {
  name: string
  path: string
  gitVersion: string
  currentBranch: string
  detached: boolean
  headSha: string
  ahead: number
  behind: number
  remoteUrl: string
  remotes: WireRemote[]
  state: RepoState
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | null
  redoLabel: string | null
}

export interface WireRemote {
  name: string
  fetchUrl: string
  pushUrl: string
}

/** Which commits to include in the commit graph. */
export type GraphScope = 'head' | 'all'

/** Commit-graph pagination metadata. */
export interface CommitPageInfo {
  /** SHA of the oldest loaded commit; pass back to fetch the next page. */
  oldestSha: string | null
  hasMore: boolean
  total: number | null
}

export interface WireRepositorySnapshot {
  repository: WireRepository
  commits: WireCommit[]
  page: CommitPageInfo
  branches: WireBranch[]
  tags: WireTag[]
  stashes: WireStash[]
  worktrees: WireWorktree[]
  workingTree: WireWorkingTreeFile[]
  authors: WireAuthor[]
  /** Git `user.name` / `user.email` for the next commit. */
  commitAuthor: WireAuthor
}

export interface SnapshotOptions {
  /** Max commits to load in the graph window. */
  commitLimit?: number
  /** HEAD-only or all branches (`--all`). Defaults to `'all'`. */
  graphScope?: GraphScope
  /** Bypass the commits cache and re-run `git log`. */
  invalidateCommits?: boolean
  /** Which parts to (re)compute; omit for a full snapshot. */
  scopes?: SnapshotScope[]
}

export type SnapshotScope = 'commits' | 'status' | 'branches' | 'tags' | 'stashes' | 'worktrees'

export interface CommitPageRequest {
  /** Load commits older than this SHA (exclusive). */
  beforeSha: string
  limit?: number
  graphScope?: GraphScope
  /** Commits already loaded; used with `graphScope: 'all'` (`git log --skip`). */
  skip?: number
}

export interface CommitPageResult {
  commits: WireCommit[]
  page: CommitPageInfo
}

/** Long-running operation progress pushed from main to renderer. */
export interface OperationProgress {
  operationId: string
  kind: string
  phase: string
  /** 0..100 when known, otherwise null for indeterminate. */
  percent: number | null
  done: boolean
}

export interface RepoChangeEvent {
  path: string
  /** Which areas likely changed, to allow scoped refresh. */
  scopes: SnapshotScope[]
}

/* ----------------------------- Diff models ----------------------------- */

export type DiffSource = 'worktree' | 'index' | 'commit' | 'range'

export interface DiffRequest {
  path: string
  source: DiffSource
  /** For source==='commit' or 'range'. */
  sha?: string
  toSha?: string
  ignoreWhitespace?: boolean
}

export interface CommitFilesRequest {
  sha: string
}

export interface CompareCommitsRequest {
  fromSha: string
  toSha: string
}

export interface DiffLine {
  type: 'context' | 'add' | 'del' | 'hunk' | 'meta'
  content: string
  oldLine: number | null
  newLine: number | null
}

export interface DiffHunk {
  header: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

export interface DiffResult {
  path: string
  oldPath?: string
  binary: boolean
  tooLarge: boolean
  language: string
  hunks: DiffHunk[]
  additions: number
  deletions: number
}

/* ----------------------------- Blame models ---------------------------- */

export interface BlameRequest {
  path: string
  source: DiffSource
  sha?: string
  toSha?: string
}

export interface WireBlameLine {
  lineNumber: number
  commitSha: string
  shortSha: string
  author: string
  authorEmail: string
  authorTime: number
  content: string
}

export interface BlameResult {
  path: string
  lines: WireBlameLine[]
}

/* ------------------------ File history models ------------------------- */

export interface FileHistoryRequest {
  path: string
  limit?: number
}

export interface FileHistoryEntry {
  sha: string
  shortSha: string
  subject: string
  author: string
  date: string
}

export interface FileHistoryResult {
  path: string
  entries: FileHistoryEntry[]
}

/* --------------------------- Conflict models --------------------------- */

export interface ConflictRequest {
  path: string
}

export interface ConflictBlock {
  index: number
  oursLabel: string
  theirsLabel: string
  ours: string
  theirs: string
  base?: string
  startLine: number
  endLine: number
}

export interface ConflictVersions {
  base: string | null
  ours: string | null
  theirs: string | null
}

export interface ConflictResult {
  path: string
  binary: boolean
  hasMarkers: boolean
  blocks: ConflictBlock[]
  versions: ConflictVersions
}

/* ---------------------------- Search models ---------------------------- */

export interface SearchQuery {
  text: string
  fields?: ('message' | 'author' | 'sha')[]
  regex?: boolean
  limit?: number
  graphScope?: GraphScope
}

export interface SearchCommitHit {
  sha: string
  shortSha: string
  subject: string
  author: string
  date: string
}

export interface SearchResults {
  commits: SearchCommitHit[]
  files: string[]
}

/* ---------------------------- Action models ---------------------------- */

export interface RecentRepository {
  path: string
  name: string
  lastOpened: number
}

export interface OpenRepoResult {
  ok: boolean
  snapshot?: WireRepositorySnapshot
  error?: import('./errors').SerializedGitError
}

export interface ActionEnvelope {
  ok: boolean
  message: string
  error?: import('./errors').SerializedGitError
  /** Conflicted files when an operation stops mid-way. */
  conflicts?: string[]
}
