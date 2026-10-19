import type {
  BlameRequest,
  BlameResult,
  CloneRepoRequest,
  CommitPageInfo,
  CommitPageRequest,
  ConflictRequest,
  ConflictResult,
  DiffRequest,
  DiffResult,
  DiscoveredRepo,
  DiscoverReposRequest,
  FileHistoryRequest,
  FileHistoryResult,
  ImagePreviewRequest,
  ImagePreviewResult,
  InitRepoRequest,
  OperationProgress,
  RecentRepository,
  RepoChangeEvent,
  SearchQuery,
  SearchResults,
  SnapshotOptions,
  SnapshotScope,
} from '@shared/git/models'
import type { GitErrorCode } from '@shared/git/errors'
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
  ): Promise<{ ok: boolean; data?: RepositoryData; message: string; errorCode?: GitErrorCode }>
  pickAndOpenRepository(options?: SnapshotRefreshOptions): Promise<{
    ok: boolean
    cancelled?: boolean
    data?: RepositoryData
    message: string
    errorCode?: GitErrorCode
  }>
  cloneRepository(
    request: CloneRepoRequest,
    options?: SnapshotRefreshOptions,
  ): Promise<{ ok: boolean; data?: RepositoryData; message: string; errorCode?: GitErrorCode }>
  initRepository(
    request: InitRepoRequest,
    options?: SnapshotRefreshOptions,
  ): Promise<{ ok: boolean; data?: RepositoryData; message: string; errorCode?: GitErrorCode }>
  discoverRepositories(request: DiscoverReposRequest): Promise<DiscoveredRepo[]>
  closeRepository(): Promise<void>
  /**
   * Optional: re-points the backend's single open repository at `path`
   * without rebuilding a snapshot, returning the canonical path it now
   * serves. Backends that accept an explicit repo path per call do not need
   * a global "current" concept and may omit this.
   */
  activateRepository?(
    path: string,
  ): Promise<{ ok: boolean; path?: string; message: string }>
  /**
   * Optional: builds a snapshot for `path` without making it the backend's
   * current repository (no watcher, journal or recents changes). Used to warm
   * inactive tabs; a preload must never re-point the repo that is on screen.
   */
  preloadRepository?(
    path: string,
    options?: SnapshotRefreshOptions,
  ): Promise<{
    ok: boolean
    data?: RepositoryData
    page?: CommitPageInfo
    message: string
    errorCode?: GitErrorCode
  }>
  loadMoreCommits(request: CommitPageRequest): Promise<{
    commits: RepositoryData['commits']
    page: CommitPageInfo
  }>
  getDiff(request: DiffRequest): Promise<DiffResult>
  getImagePreview(request: ImagePreviewRequest): Promise<ImagePreviewResult>
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
