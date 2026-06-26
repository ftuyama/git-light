import type {
  CommitPageInfo,
  DiffRequest,
  DiffResult,
  OperationProgress,
  RecentRepository,
  RepoChangeEvent,
  SearchQuery,
  SearchResults,
  SnapshotOptions,
  SnapshotScope,
} from '@shared/git/models'
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
  loadMoreCommits(): Promise<{ commits: RepositoryData['commits']; hasMore: boolean }>
  getDiff(request: DiffRequest): Promise<DiffResult>
  getCommitFiles(sha: string): Promise<RepositoryData['workingTree']>
  search(query: SearchQuery): Promise<SearchResults>
  openTerminal(path?: string): Promise<boolean>
  revealPath(path: string): Promise<void>
  cancelActiveOperation(): Promise<void>
  readonly commitPage: CommitPageInfo
  onRepositoryChanged(cb: (event: RepoChangeEvent) => void): () => void
  onProgress(cb: (progress: OperationProgress) => void): () => void
  load?(): Promise<RepositoryData>
}
