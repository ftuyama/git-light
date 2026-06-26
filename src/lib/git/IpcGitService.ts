import { GitError } from '@shared/git/errors'
import type {
  CommitPageInfo,
  CommitPageRequest,
  ConflictRequest,
  ConflictResult,
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
import type { RebaseCommitsRequest, RebaseCommitsResult } from '@shared/git/rebase'
import type { ActionResult, GitAction, RepositoryData } from '@/types/git'
import type { GitService, SnapshotRefreshOptions } from './GitService'
import { wireSnapshotToRepositoryData, reviveWorkingTreeFile, reviveCommits } from './wireAdapter'

function envelopeToResult(envelope: {
  ok: boolean
  message: string
  error?: ReturnType<GitError['serialize']>
}): ActionResult {
  if (envelope.error) {
    const err = envelope.error
    const detail = err.detail ? `: ${err.detail}` : ''
    return { ok: false, message: `${err.message}${detail}`, errorCode: err.code }
  }
  return { ok: envelope.ok, message: envelope.message }
}

function toSnapshotOptions(
  scopes?: SnapshotScope[],
  options?: SnapshotRefreshOptions,
): SnapshotOptions | undefined {
  if (!scopes && !options) return undefined
  return { scopes, ...options }
}

/**
 * Renderer-side GitService backed by typed IPC to the main-process GitProvider.
 */
export class IpcGitService implements GitService {
  private page: CommitPageInfo = { oldestSha: null, hasMore: false, total: null }

  get commitPage(): CommitPageInfo {
    return this.page
  }

  async recentRepos(): Promise<RecentRepository[]> {
    return window.electron.git.recentRepos()
  }

  async removeRecent(path: string): Promise<RecentRepository[]> {
    return window.electron.git.removeRecent({ path })
  }

  async openRepository(
    path: string,
    options?: SnapshotRefreshOptions,
  ): Promise<{ ok: boolean; data?: RepositoryData; message: string }> {
    const result = await window.electron.git.openRepo({ path, options })
    if (!result.ok || !result.snapshot) {
      const err = result.error
      return {
        ok: false,
        message: err?.message ?? 'Failed to open repository.',
      }
    }
    const data = wireSnapshotToRepositoryData(result.snapshot)
    this.page = data.page
    return { ok: true, data, message: `Opened ${data.repository.name}` }
  }

  async pickAndOpenRepository(
    options?: SnapshotRefreshOptions,
  ): Promise<{
    ok: boolean
    cancelled?: boolean
    data?: RepositoryData
    message: string
  }> {
    const result = await window.electron.git.pickAndOpenRepo({ options })
    if ('cancelled' in result) {
      return { ok: false, cancelled: true, message: '' }
    }
    if (!result.ok || !result.snapshot) {
      const err = result.error
      return {
        ok: false,
        message: err?.message ?? 'Failed to open repository.',
      }
    }
    const data = wireSnapshotToRepositoryData(result.snapshot)
    this.page = data.page
    return { ok: true, data, message: `Opened ${data.repository.name}` }
  }

  async closeRepository(): Promise<void> {
    await window.electron.git.closeRepo()
    this.page = { oldestSha: null, hasMore: false, total: null }
  }

  async refreshSnapshot(
    scopes?: SnapshotScope[],
    options?: SnapshotRefreshOptions,
  ): Promise<RepositoryData> {
    const snapshot = await window.electron.git.snapshot({
      options: toSnapshotOptions(scopes, options),
    })
    const data = wireSnapshotToRepositoryData(snapshot)
    this.page = data.page
    return data
  }

  async loadMoreCommits(request: CommitPageRequest): Promise<{
    commits: RepositoryData['commits']
    page: CommitPageInfo
  }> {
    const result = await window.electron.git.commitPage(request)
    this.page = result.page
    return { commits: reviveCommits(result.commits), page: result.page }
  }

  /** @deprecated Use openRepository / refreshSnapshot instead. */
  async load(): Promise<RepositoryData> {
    return this.refreshSnapshot()
  }

  async execute(action: GitAction): Promise<ActionResult> {
    const envelope = await window.electron.git.action(action)
    return envelopeToResult(envelope)
  }

  async getDiff(request: DiffRequest): Promise<DiffResult> {
    return window.electron.git.diff(request)
  }

  async getConflict(request: ConflictRequest): Promise<ConflictResult> {
    return window.electron.git.conflict(request)
  }

  async getCommitFiles(sha: string): Promise<RepositoryData['workingTree']> {
    const wire = await window.electron.git.commitFiles({ sha })
    return wire.map(reviveWorkingTreeFile)
  }

  async getCompareFiles(fromSha: string, toSha: string): Promise<RepositoryData['workingTree']> {
    const wire = await window.electron.git.compareFiles({ fromSha, toSha })
    return wire.map(reviveWorkingTreeFile)
  }

  async search(query: SearchQuery): Promise<SearchResults> {
    return window.electron.git.search(query)
  }

  async getRebaseCommits(request: RebaseCommitsRequest): Promise<RebaseCommitsResult> {
    return window.electron.git.rebaseCommits(request)
  }

  async openTerminal(path?: string): Promise<boolean> {
    const result = await window.electron.git.openTerminal({ path })
    return result.ok
  }

  async revealPath(path: string): Promise<void> {
    await window.electron.git.revealPath({ path })
  }

  async cancelActiveOperation(): Promise<void> {
    await window.electron.git.cancel()
  }

  onRepositoryChanged(cb: (event: RepoChangeEvent) => void): () => void {
    return window.electron.git.onChanged(cb)
  }

  onProgress(cb: (progress: OperationProgress) => void): () => void {
    return window.electron.git.onProgress(cb)
  }
}

export const ipcGitService = new IpcGitService()
