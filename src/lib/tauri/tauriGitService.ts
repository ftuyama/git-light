import { GitError } from '@shared/git/errors'
import type {
  ActionEnvelope,
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
  WireWorkingTreeFile,
} from '@shared/git/models'
import type { RebaseCommitsRequest, RebaseCommitsResult } from '@shared/git/rebase'
import type { ActionResult, GitAction, RepositoryData } from '@/types/git'
import type { GitService, SnapshotRefreshOptions } from '../git/GitService'
import { wireSnapshotToRepositoryData, reviveCommits, reviveWorkingTreeFile } from '../git/wireAdapter'
import { defaultInvoke, defaultListen, type InvokeFn, type ListenFn } from './invoke'

function envelopeToResult(envelope: ActionEnvelope): ActionResult {
  if (envelope.error) {
    const err = envelope.error
    const detail = err.detail ? `: ${err.detail}` : ''
    return { ok: false, message: `${err.message}${detail}`, errorCode: err.code, commands: envelope.commands }
  }
  return { ok: envelope.ok, message: envelope.message, commands: envelope.commands }
}

function toSnapshotOptions(
  scopes?: SnapshotScope[],
  options?: SnapshotRefreshOptions,
): SnapshotOptions | undefined {
  if (!scopes && !options) return undefined
  return { scopes, ...options }
}

function subscribe<T>(
  listenFn: ListenFn,
  event: string,
  cb: (payload: T) => void,
): () => void {
  let unsub: (() => void) | null = null
  let active = true
  void listenFn<T>(event, (e) => cb(e.payload)).then((u) => {
    if (active) unsub = u
    else u()
  })
  return () => {
    active = false
    unsub?.()
  }
}

/**
 * Renderer-side GitService backed by Tauri `invoke` commands served by
 * `src-tauri`. The Vue layer stays backend-agnostic via the `GitService` interface.
 */
export class TauriGitService implements GitService {
  private page: CommitPageInfo = { oldestSha: null, hasMore: false, total: null }

  constructor(
    private readonly invoker: InvokeFn = defaultInvoke,
    private readonly listenFn: ListenFn = defaultListen,
  ) {}

  get commitPage(): CommitPageInfo {
    return this.page
  }

  async recentRepos(): Promise<RecentRepository[]> {
    return (await this.invoker('git_recent_repos', undefined)) as RecentRepository[]
  }

  async removeRecent(path: string): Promise<RecentRepository[]> {
    return (await this.invoker('git_remove_recent', { path })) as RecentRepository[]
  }

  async openRepository(
    path: string,
    options?: SnapshotRefreshOptions,
  ): Promise<{ ok: boolean; data?: RepositoryData; message: string; errorCode?: GitError['code'] }> {
    const result = (await this.invoker('git_open_repo', { path, options })) as {
      ok: boolean
      snapshot?: Parameters<typeof wireSnapshotToRepositoryData>[0]
      error?: ReturnType<GitError['serialize']>
    }
    if (!result.ok || !result.snapshot) {
      return {
        ok: false,
        message: result.error?.message ?? 'Failed to open repository.',
        errorCode: result.error?.code,
      }
    }
    const data = wireSnapshotToRepositoryData(result.snapshot)
    this.page = data.page
    return { ok: true, data, message: `Opened ${data.repository.name}` }
  }

  private applyOpenedSnapshot(result: {
    ok: boolean
    snapshot?: Parameters<typeof wireSnapshotToRepositoryData>[0]
    error?: ReturnType<GitError['serialize']>
  }): { ok: boolean; data?: RepositoryData; message: string; errorCode?: GitError['code'] } {
    if (!result.ok || !result.snapshot) {
      return {
        ok: false,
        message: result.error?.message ?? 'Failed to open repository.',
        errorCode: result.error?.code,
      }
    }
    const data = wireSnapshotToRepositoryData(result.snapshot)
    this.page = data.page
    return { ok: true, data, message: `Opened ${data.repository.name}` }
  }

  async pickAndOpenRepository(
    options?: SnapshotRefreshOptions,
  ): Promise<{ ok: boolean; cancelled?: boolean; data?: RepositoryData; message: string; errorCode?: GitError['code'] }> {
    const result = (await this.invoker('git_pick_and_open_repo', { options })) as
      | { cancelled: true }
      | {
          ok: boolean
          snapshot?: Parameters<typeof wireSnapshotToRepositoryData>[0]
          error?: ReturnType<GitError['serialize']>
        }
    if ('cancelled' in result) {
      return { ok: false, cancelled: true, message: '' }
    }
    if (!result.ok || !result.snapshot) {
      return {
        ok: false,
        message: result.error?.message ?? 'Failed to open repository.',
        errorCode: result.error?.code,
      }
    }
    const data = wireSnapshotToRepositoryData(result.snapshot)
    this.page = data.page
    return { ok: true, data, message: `Opened ${data.repository.name}` }
  }

  async cloneRepository(
    request: CloneRepoRequest,
    options?: SnapshotRefreshOptions,
  ): Promise<{ ok: boolean; data?: RepositoryData; message: string; errorCode?: GitError['code'] }> {
    const result = (await this.invoker('git_clone_repo', { request, options })) as {
      ok: boolean
      snapshot?: Parameters<typeof wireSnapshotToRepositoryData>[0]
      error?: ReturnType<GitError['serialize']>
    }
    return this.applyOpenedSnapshot(result)
  }

  async initRepository(
    request: InitRepoRequest,
    options?: SnapshotRefreshOptions,
  ): Promise<{ ok: boolean; data?: RepositoryData; message: string; errorCode?: GitError['code'] }> {
    const result = (await this.invoker('git_init_repo', { request, options })) as {
      ok: boolean
      snapshot?: Parameters<typeof wireSnapshotToRepositoryData>[0]
      error?: ReturnType<GitError['serialize']>
    }
    return this.applyOpenedSnapshot(result)
  }

  async discoverRepositories(request: DiscoverReposRequest): Promise<DiscoveredRepo[]> {
    return (await this.invoker('git_discover_repos', { request })) as DiscoveredRepo[]
  }

  async closeRepository(): Promise<void> {
    await this.invoker('git_close_repo', undefined)
    this.page = { oldestSha: null, hasMore: false, total: null }
  }

  async refreshSnapshot(
    scopes?: SnapshotScope[],
    options?: SnapshotRefreshOptions,
  ): Promise<RepositoryData> {
    const snapshot = (await this.invoker('git_snapshot', {
      options: toSnapshotOptions(scopes, options),
    })) as Parameters<typeof wireSnapshotToRepositoryData>[0]
    const data = wireSnapshotToRepositoryData(snapshot)
    this.page = data.page
    return data
  }

  async loadMoreCommits(request: CommitPageRequest): Promise<{
    commits: RepositoryData['commits']
    page: CommitPageInfo
  }> {
    const result = (await this.invoker('git_commit_page', { request })) as {
      commits: Parameters<typeof reviveCommits>[0]
      page: CommitPageInfo
    }
    this.page = result.page
    return { commits: reviveCommits(result.commits), page: result.page }
  }

  /** @deprecated Use openRepository / refreshSnapshot instead. */
  async load(): Promise<RepositoryData> {
    return this.refreshSnapshot()
  }

  async execute(action: GitAction): Promise<ActionResult> {
    const envelope = (await this.invoker('git_execute_action', { action })) as ActionEnvelope
    return envelopeToResult(envelope)
  }

  async getDiff(request: DiffRequest): Promise<DiffResult> {
    return (await this.invoker('git_get_diff', { request })) as DiffResult
  }

  async getImagePreview(request: ImagePreviewRequest): Promise<ImagePreviewResult> {
    return (await this.invoker('git_get_image_preview', { request })) as ImagePreviewResult
  }

  async getBlame(request: BlameRequest): Promise<BlameResult> {
    return (await this.invoker('git_get_blame', { request })) as BlameResult
  }

  async getFileHistory(request: FileHistoryRequest): Promise<FileHistoryResult> {
    return (await this.invoker('git_get_file_history', { request })) as FileHistoryResult
  }

  async getConflict(request: ConflictRequest): Promise<ConflictResult> {
    return (await this.invoker('git_get_conflict', { request })) as ConflictResult
  }

  async getCommitFiles(sha: string): Promise<RepositoryData['workingTree']> {
    const wire = (await this.invoker('git_get_commit_files', { request: { sha } })) as WireWorkingTreeFile[]
    return wire.map(reviveWorkingTreeFile)
  }

  async getCompareFiles(fromSha: string, toSha: string): Promise<RepositoryData['workingTree']> {
    const wire = (await this.invoker('git_get_compare_files', {
      request: {
        fromSha,
        toSha,
      },
    })) as WireWorkingTreeFile[]
    return wire.map(reviveWorkingTreeFile)
  }

  async search(query: SearchQuery): Promise<SearchResults> {
    return (await this.invoker('git_search', { request: query })) as SearchResults
  }

  async getRebaseCommits(request: RebaseCommitsRequest): Promise<RebaseCommitsResult> {
    return (await this.invoker('git_get_rebase_commits', { request })) as RebaseCommitsResult
  }

  async openTerminal(path?: string): Promise<boolean> {
    const result = (await this.invoker('git_open_terminal_external', { path })) as { ok: boolean }
    return result.ok
  }

  async revealPath(path: string): Promise<void> {
    await this.invoker('git_reveal_path', { path })
  }

  async cancelActiveOperation(): Promise<void> {
    await this.invoker('git_cancel', undefined)
  }

  onRepositoryChanged(cb: (event: RepoChangeEvent) => void): () => void {
    return subscribe(this.listenFn, 'git:changed', cb)
  }

  onProgress(cb: (progress: OperationProgress) => void): () => void {
    return subscribe(this.listenFn, 'git:progress', cb)
  }
}

export const tauriGitService = new TauriGitService()
