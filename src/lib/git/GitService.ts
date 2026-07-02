import type {
  BlameRequest,
  BlameResult,
  CommitPageInfo,
  CommitPageRequest,
  ConflictRequest,
  ConflictResult,
  DiffRequest,
  DiffResult,
  FileHistoryRequest,
  FileHistoryResult,
  OperationProgress,
  RecentRepository,
  RepoChangeEvent,
  SearchQuery,
  SearchResults,
  SnapshotOptions,
  SnapshotScope,
} from '@shared/git/models'
import type { RebaseCommitsRequest, RebaseCommitsResult } from '@shared/git/rebase'
import type { ActionResult, GitAction, RepositoryData } from '@/types/git'

export type SnapshotRefreshOptions = Pick<
  SnapshotOptions,
  'graphScope' | 'commitLimit' | 'invalidateCommits'
>

export interface GitService {
  refreshSnapshot(
    scopes?: SnapshotScope[],
    options?: SnapshotRefreshOptions,
  ): Promise<RepositoryData>
  execute(action: GitAction): Promise<ActionResult>
  recentRepos(): Promise<RecentRepository[]>
  removeRecent(path: string): Promise<RecentRepository[]>
  openRepository(
    path: string,
    options?: SnapshotRefreshOptions,
  ): Promise<{ ok: boolean; data?: RepositoryData; message: string }>
  pickAndOpenRepository(options?: SnapshotRefreshOptions): Promise<{
    ok: boolean
    cancelled?: boolean
    data?: RepositoryData
    message: string
  }>
  closeRepository(): Promise<void>
  loadMoreCommits(request: CommitPageRequest): Promise<{
    commits: RepositoryData['commits']
    page: CommitPageInfo
  }>
  getDiff(request: DiffRequest): Promise<DiffResult>
  getBlame(request: BlameRequest): Promise<BlameResult>
  getFileHistory(request: FileHistoryRequest): Promise<FileHistoryResult>
  getConflict(request: ConflictRequest): Promise<ConflictResult>
  getCommitFiles(sha: string): Promise<RepositoryData['workingTree']>
  getCompareFiles(fromSha: string, toSha: string): Promise<RepositoryData['workingTree']>
  search(query: SearchQuery): Promise<SearchResults>
  getRebaseCommits(request: RebaseCommitsRequest): Promise<RebaseCommitsResult>
  openTerminal(path?: string): Promise<boolean>
  revealPath(path: string): Promise<void>
  cancelActiveOperation(): Promise<void>
  readonly commitPage: CommitPageInfo
  onRepositoryChanged(cb: (event: RepoChangeEvent) => void): () => void
  onProgress(cb: (progress: OperationProgress) => void): () => void
  load?(): Promise<RepositoryData>
}
