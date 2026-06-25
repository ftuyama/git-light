import type {
  CommitPageInfo,
  DiffRequest,
  DiffResult,
  OperationProgress,
  RecentRepository,
  RepoChangeEvent,
  SearchQuery,
  SearchResults,
  SnapshotScope,
} from '@shared/git/models'
import type { ActionResult, GitAction, RepositoryData } from '@/types/git'

export interface GitService {
  refreshSnapshot(scopes?: SnapshotScope[]): Promise<RepositoryData>
  execute(action: GitAction): Promise<ActionResult>
  recentRepos(): Promise<RecentRepository[]>
  removeRecent(path: string): Promise<RecentRepository[]>
  openRepository(path: string): Promise<{ ok: boolean; data?: RepositoryData; message: string }>
  pickAndOpenRepository(): Promise<{
    ok: boolean
    cancelled?: boolean
    data?: RepositoryData
    message: string
  }>
  closeRepository(): Promise<void>
  loadMoreCommits(): Promise<{ commits: RepositoryData['commits']; hasMore: boolean }>
  getDiff(request: DiffRequest): Promise<DiffResult>
  search(query: SearchQuery): Promise<SearchResults>
  openTerminal(path?: string): Promise<boolean>
  revealPath(path: string): Promise<void>
  cancelActiveOperation(): Promise<void>
  readonly commitPage: CommitPageInfo
  onRepositoryChanged(cb: (event: RepoChangeEvent) => void): () => void
  onProgress(cb: (progress: OperationProgress) => void): () => void
  load?(): Promise<RepositoryData>
}
