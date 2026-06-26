import type { CommitPageInfo, CommitPageRequest, ConflictRequest, ConflictResult, DiffRequest, DiffResult, RecentRepository, RepoChangeEvent, SearchQuery, SearchResults, SnapshotScope } from '@shared/git/models'
import type { RebaseCommitsRequest, RebaseCommitsResult } from '@shared/git/rebase'
import { isJournalableAction, journalLabel } from '@shared/git/undoPolicy'
import type { ActionResult, GitAction, GitActionKind, RepositoryData } from '@/types/git'
import { DEFAULT_COMMIT_GRAPH_LIMIT } from '@/lib/preferences'
import { generateAwesomeShop } from '@/data/generateAwesomeShop'
import type { GitService, SnapshotRefreshOptions } from './GitService'

const ACTION_MESSAGES: Partial<Record<GitActionKind, (target?: string) => string>> = {
  fetch: () => 'Fetched from origin',
  pull: () => 'Pulled latest changes from origin',
  push: () => 'Pushed commits to origin',
  'force-push': () => 'Force-pushed to origin',
  sync: () => 'Synced with origin',
  stash: () => 'Saved working tree to stash',
  'pop-stash': () => 'Popped latest stash',
  'apply-stash': () => 'Applied stash',
  'drop-stash': () => 'Dropped stash',
  'cherry-pick': (t) => `Cherry-picked ${t ?? 'commit'}`,
  merge: (t) => `Merged ${t ?? 'branch'}`,
  rebase: (t) => `Rebased onto ${t ?? 'branch'}`,
  'interactive-rebase': () => 'Started interactive rebase',
  'reset-soft': (t) => `Soft reset to ${t ?? 'commit'}`,
  'reset-mixed': (t) => `Mixed reset to ${t ?? 'commit'}`,
  'reset-hard': (t) => `Hard reset to ${t ?? 'commit'}`,
  revert: (t) => `Reverted ${t ?? 'commit'}`,
  undo: () => 'Undid last operation',
  redo: () => 'Redid operation',
  refresh: () => 'Refreshed repository',
  'open-terminal': () => 'Opened terminal',
  checkout: (t) => `Checked out ${t ?? 'branch'}`,
  'create-branch': (t) => `Created branch ${t ?? ''}`.trim(),
  'delete-branch': (t) => `Deleted branch ${t ?? ''}`.trim(),
  'rename-branch': (t) => `Renamed branch ${t ?? ''}`.trim(),
  'compare-branches': () => 'Comparing branches',
  tag: (t) => `Tagged ${t ?? 'commit'}`,
  'copy-sha': () => 'Copied SHA to clipboard',
  'open-on-github': () => 'Opened on GitHub',
  'rebase-from-here': (t) => `Rebasing from ${t ?? 'commit'}`,
  'stage-all': () => 'Staged all changes',
  'unstage-all': () => 'Unstaged all changes',
  stage: (t) => `Staged ${t ?? 'file'}`,
  unstage: (t) => `Unstaged ${t ?? 'file'}`,
  commit: () => 'Created commit',
  'commit-and-push': () => 'Committed and pushed',
  'commit-and-force-push': () => 'Committed and force-pushed',
}

/**
 * In-memory implementation backed by generated data. Actions resolve after a
 * short delay to mimic real latency so the UI can show progress states.
 */
export class MockGitService implements GitService {
  private data: RepositoryData | null = null
  private page: CommitPageInfo = { oldestSha: null, hasMore: false, total: null }
  private undoLabels: string[] = []
  private redoLabels: string[] = []

  get commitPage(): CommitPageInfo {
    return this.page
  }

  async recentRepos(): Promise<RecentRepository[]> {
    return []
  }

  async removeRecent(_path: string): Promise<RecentRepository[]> {
    return []
  }

  async openRepository(
    _path: string,
    options?: SnapshotRefreshOptions,
  ): Promise<{ ok: boolean; data?: RepositoryData; message: string }> {
    const data = await this.load(options)
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
    const data = await this.load(options)
    return { ok: true, data, message: `Opened ${data.repository.name}` }
  }

  async closeRepository(): Promise<void> {
    this.data = null
    this.undoLabels = []
    this.redoLabels = []
  }

  async refreshSnapshot(
    _scopes?: SnapshotScope[],
    options?: SnapshotRefreshOptions,
  ): Promise<RepositoryData> {
    return this.load(options)
  }

  async loadMoreCommits(request: CommitPageRequest): Promise<{
    commits: RepositoryData['commits']
    page: CommitPageInfo
  }> {
    await delay(200)
    if (!this.data) return { commits: [], page: this.page }
    const limit = request.limit ?? DEFAULT_COMMIT_GRAPH_LIMIT
    const beforeIndex = this.data.commits.findIndex((c) => c.sha === request.beforeSha)
    if (beforeIndex < 0) {
      return { commits: [], page: { ...this.page, hasMore: false } }
    }
    const start = beforeIndex + 1
    const commits = this.data.commits.slice(start, start + limit)
    const hasMore = start + limit < this.data.commits.length
    const page: CommitPageInfo = {
      oldestSha: commits.at(-1)?.sha ?? null,
      hasMore,
      total: null,
    }
    this.page = page
    return { commits, page }
  }

  async getDiff(_request: DiffRequest): Promise<DiffResult> {
    return {
      path: _request.path,
      binary: false,
      tooLarge: false,
      language: 'plaintext',
      hunks: [],
      additions: 0,
      deletions: 0,
    }
  }

  async getConflict(request: ConflictRequest): Promise<ConflictResult> {
    return {
      path: request.path,
      binary: false,
      hasMarkers: false,
      blocks: [],
      versions: { base: null, ours: null, theirs: null },
    }
  }

  async getCommitFiles(sha: string): Promise<RepositoryData['workingTree']> {
    const data = await this.load()
    const commit = data.commits.find((c) => c.sha === sha)
    if (!commit) return []
    const limit = commit.isMerge ? 8 : 5
    return data.workingTree.slice(0, Math.min(limit, data.workingTree.length)).map((file, index) => ({
      ...file,
      id: `commit-${sha.slice(0, 7)}-${index}`,
      staged: false,
    }))
  }

  async search(query: SearchQuery): Promise<SearchResults> {
    const data = await this.load()
    const needle = query.text.toLowerCase()
    const commits = data.commits
      .filter((c) => c.subject.toLowerCase().includes(needle) || c.sha.startsWith(needle))
      .slice(0, query.limit ?? 50)
      .map((c) => ({
        sha: c.sha,
        shortSha: c.shortSha,
        subject: c.subject,
        author: c.author.name,
        date: c.date.toISOString(),
      }))
    const files = data.workingTree
      .map((f) => f.path)
      .filter((p) => p.toLowerCase().includes(needle))
      .slice(0, query.limit ?? 50)
    return { commits, files }
  }

  async getRebaseCommits(request: RebaseCommitsRequest): Promise<RebaseCommitsResult> {
    const data = await this.load()
    const countMatch = /^HEAD~(\d+)$/.exec(request.base.trim())
    const count = countMatch ? Number(countMatch[1]) : 5
    const slice = data.commits.slice(0, Math.max(1, count)).reverse()
    return {
      base: request.base,
      baseShortSha: slice[0]?.shortSha ?? 'base',
      commits: slice.map((c) => ({
        sha: c.sha,
        shortSha: c.shortSha,
        subject: c.subject,
        authorName: c.author.name,
        date: c.date.toISOString(),
      })),
    }
  }

  async openTerminal(): Promise<boolean> {
    return true
  }

  async revealPath(): Promise<void> {}

  async cancelActiveOperation(): Promise<void> {}

  async load(options?: SnapshotRefreshOptions): Promise<RepositoryData> {
    await delay(280)
    if (!this.data) this.data = generateAwesomeShop(400)
    const limit = options?.commitLimit ?? DEFAULT_COMMIT_GRAPH_LIMIT
    const commits = this.data.commits.slice(0, limit)
    const page: CommitPageInfo = {
      oldestSha: commits.at(-1)?.sha ?? null,
      hasMore: this.data.commits.length > limit,
      total: null,
    }
    this.page = page
    this.syncUndoState()
    return { ...this.data, commits }
  }

  private syncUndoState(): void {
    if (!this.data) return
    this.data.repository = {
      ...this.data.repository,
      canUndo: this.undoLabels.length > 0,
      canRedo: this.redoLabels.length > 0,
      undoLabel: this.undoLabels.at(-1) ?? null,
      redoLabel: this.redoLabels.at(-1) ?? null,
    }
  }

  async execute(action: GitAction): Promise<ActionResult> {
    try {
      await window.electron?.git.action(action)
    } catch {
      /* browser tests */
    }
    await delay(latencyFor(action.kind))

    if (action.kind === 'undo') {
      if (this.undoLabels.length === 0) {
        return { ok: false, message: 'Nothing to undo.' }
      }
      const label = this.undoLabels.pop()!
      this.redoLabels.push(label)
      this.syncUndoState()
      return { ok: true, message: `Undid ${label}` }
    }

    if (action.kind === 'redo') {
      if (this.redoLabels.length === 0) {
        return { ok: false, message: 'Nothing to redo.' }
      }
      const label = this.redoLabels.pop()!
      this.undoLabels.push(label)
      this.syncUndoState()
      return { ok: true, message: `Redid ${label}` }
    }

    const message = ACTION_MESSAGES[action.kind]?.(action.target) ?? `Ran ${action.kind}`
    if (isJournalableAction(action.kind)) {
      this.undoLabels.push(journalLabel(action))
      this.redoLabels = []
      this.syncUndoState()
    }
    return { ok: true, message }
  }

  onRepositoryChanged(_cb: (event: RepoChangeEvent) => void): () => void {
    return () => {}
  }

  onProgress(_cb: (progress: import('@shared/git/models').OperationProgress) => void): () => void {
    return () => {}
  }
}

function latencyFor(kind: GitActionKind): number {
  if (kind === 'fetch' || kind === 'pull' || kind === 'sync') return 900
  if (kind === 'push' || kind === 'force-push' || kind === 'commit-and-push' || kind === 'commit-and-force-push') return 1100
  if (kind === 'copy-sha' || kind === 'undo' || kind === 'redo') return 120
  return 360
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
