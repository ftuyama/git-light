import type { CommitPageInfo, DiffRequest, DiffResult, RecentRepository, RepoChangeEvent, SearchQuery, SearchResults, SnapshotScope } from '@shared/git/models'
import type { ActionResult, GitAction, GitActionKind, RepositoryData } from '@/types/git'
import { generateAwesomeShop } from '@/data/generateAwesomeShop'
import type { GitService } from './GitService'

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
}

/**
 * In-memory implementation backed by generated data. Actions resolve after a
 * short delay to mimic real latency so the UI can show progress states.
 */
export class MockGitService implements GitService {
  private data: RepositoryData | null = null
  private page: CommitPageInfo = { oldestSha: null, hasMore: false, total: null }

  get commitPage(): CommitPageInfo {
    return this.page
  }

  async recentRepos(): Promise<RecentRepository[]> {
    return []
  }

  async removeRecent(_path: string): Promise<RecentRepository[]> {
    return []
  }

  async openRepository(_path: string): Promise<{ ok: boolean; data?: RepositoryData; message: string }> {
    const data = await this.load()
    return { ok: true, data, message: `Opened ${data.repository.name}` }
  }

  async pickAndOpenRepository(): Promise<{
    ok: boolean
    cancelled?: boolean
    data?: RepositoryData
    message: string
  }> {
    const data = await this.load()
    return { ok: true, data, message: `Opened ${data.repository.name}` }
  }

  async closeRepository(): Promise<void> {
    this.data = null
  }

  async refreshSnapshot(_scopes?: SnapshotScope[]): Promise<RepositoryData> {
    return this.load()
  }

  async loadMoreCommits(): Promise<{ commits: RepositoryData['commits']; hasMore: boolean }> {
    return { commits: [], hasMore: false }
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

  async openTerminal(): Promise<boolean> {
    return true
  }

  async revealPath(): Promise<void> {}

  async cancelActiveOperation(): Promise<void> {}

  async load(): Promise<RepositoryData> {
    await delay(280)
    if (!this.data) this.data = generateAwesomeShop(400)
    return this.data
  }

  async execute(action: GitAction): Promise<ActionResult> {
    try {
      await window.electron?.git.action(action)
    } catch {
      /* browser tests */
    }
    await delay(latencyFor(action.kind))
    const message = ACTION_MESSAGES[action.kind]?.(action.target) ?? `Ran ${action.kind}`
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
  if (kind === 'push' || kind === 'force-push' || kind === 'commit-and-push') return 1100
  if (kind === 'copy-sha' || kind === 'undo' || kind === 'redo') return 120
  return 360
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
