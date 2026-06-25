import { existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { GitAction } from '@shared/git/actions'
import { GitError } from '@shared/git/errors'
import type {
  ActionEnvelope,
  CommitPageRequest,
  CommitPageResult,
  DiffRequest,
  DiffResult,
  OpenRepoResult,
  OperationProgress,
  RecentRepository,
  RepoChangeEvent,
  SearchQuery,
  SearchResults,
  SnapshotOptions,
  SnapshotScope,
  WireRepositorySnapshot,
} from '@shared/git/models'
import { gitCli } from './GitCliProvider'
import { executeGitAction } from './ActionRouter'
import { RepoCache } from './RepoCache'
import { repoNameFromPath, resolveRepoPath } from './pathUtils'
import { AuthorRegistry } from './parsers/authors'
import { parseBranches, BRANCH_FORMAT, BRANCH_REFSPECS } from './parsers/branchParser'
import { parseCommits, LOG_FORMAT } from './parsers/logParser'
import { parseRemotes, parseTags, TAG_FORMAT } from './parsers/refParser'
import { parseNumstat, parseStatus } from './parsers/statusParser'
import { parseStashes, STASH_FORMAT } from './parsers/stashParser'
import { readRepoState } from './parsers/stateParser'
import { parseWorktrees } from './parsers/worktreeParser'
import { parseUnifiedDiff } from './parsers/diffParser'

const DEFAULT_COMMIT_LIMIT = 500

interface ActiveOperation {
  controller: AbortController
  kind: string
}

export interface GitProviderHooks {
  onChanged?: (event: RepoChangeEvent) => void
  onProgress?: (progress: OperationProgress) => void
  getRecent?: () => RecentRepository[]
  setRecent?: (list: RecentRepository[]) => void
  getFavorites?: (repoPath: string) => Set<string>
}

export class GitProvider {
  private repoPath: string | null = null
  private gitDir: string | null = null
  private gitVersion = ''
  private cache = new RepoCache()
  private operations = new Map<string, ActiveOperation>()
  private hooks: GitProviderHooks

  constructor(hooks: GitProviderHooks = {}) {
    this.hooks = hooks
  }

  setHooks(hooks: GitProviderHooks): void {
    this.hooks = { ...this.hooks, ...hooks }
  }

  get currentPath(): string | null {
    return this.repoPath
  }

  recentRepos(): RecentRepository[] {
    return this.hooks.getRecent?.() ?? []
  }

  removeRecent(path: string): RecentRepository[] {
    const list = this.recentRepos().filter((r) => r.path !== path)
    this.hooks.setRecent?.(list)
    return list
  }

  private touchRecent(path: string): void {
    const name = repoNameFromPath(path)
    const list = [
      { path, name, lastOpened: Date.now() },
      ...this.recentRepos().filter((r) => r.path !== path),
    ].slice(0, 12)
    this.hooks.setRecent?.(list)
  }

  async open(path: string, options: SnapshotOptions = {}): Promise<OpenRepoResult> {
    try {
      const resolved = resolveRepoPath(path)
      await this.validateRepository(resolved)
      this.repoPath = resolved
      this.touchRecent(resolved)
      const snapshot = await this.snapshot(options)
      return { ok: true, snapshot }
    } catch (error) {
      if (error instanceof GitError) {
        return { ok: false, error: error.serialize() }
      }
      return {
        ok: false,
        error: new GitError('Unknown', error instanceof Error ? error.message : String(error)).serialize(),
      }
    }
  }

  close(): void {
    this.repoPath = null
    this.gitDir = null
    this.cache.clear()
  }

  private async validateRepository(cwd: string): Promise<void> {
    try {
      const gitDirResult = await gitCli.run(['rev-parse', '--git-dir'], { cwd })
      this.gitDir = resolve(cwd, gitDirResult.stdout.trim())
    } catch {
      throw new GitError('NotARepository', 'This folder is not a Git repository.')
    }

    const bareResult = await gitCli.run(['rev-parse', '--is-bare-repository'], { cwd, allowFailure: true })
    if (bareResult.stdout.trim() === 'true') {
      throw new GitError('BareRepository', 'Bare repositories are not supported yet.')
    }

    if (!existsSync(this.gitDir)) {
      throw new GitError('RepositoryNotFound', 'The .git directory is missing.')
    }

    const versionResult = await gitCli.run(['--version'], { cwd })
    this.gitVersion = versionResult.stdout.replace('git version ', '').trim()
  }

  async snapshot(options: SnapshotOptions = {}): Promise<WireRepositorySnapshot> {
    const cwd = this.requireRepo()
    const scopes = options.scopes
    const favorites = this.hooks.getFavorites?.(cwd) ?? new Set<string>()

    const headSha = (await gitCli.run(['rev-parse', 'HEAD'], { cwd, allowFailure: true })).stdout.trim()
    this.cache.setHead(headSha || 'empty')

    const need = (scope: SnapshotScope): boolean => !scopes || scopes.includes(scope)

    const [commitsBundle, branches, tags, stashes, worktrees, workingTree, remotes, branchName] =
      await Promise.all([
        need('commits')
          ? this.loadCommits(cwd, options.commitLimit ?? DEFAULT_COMMIT_LIMIT, 0)
          : Promise.resolve({ commits: [], page: { oldestSha: null, hasMore: false, total: null } }),
        need('branches') ? this.loadBranches(cwd, favorites) : Promise.resolve([]),
        need('tags') ? this.loadTags(cwd) : Promise.resolve([]),
        need('stashes') ? this.loadStashes(cwd) : Promise.resolve([]),
        need('worktrees') ? this.loadWorktrees(cwd) : Promise.resolve([]),
        need('status') ? this.loadWorkingTree(cwd) : Promise.resolve([]),
        gitCli.run(['remote', '-v'], { cwd, allowFailure: true }).then((r) => parseRemotes(r.stdout)),
        gitCli
          .run(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, allowFailure: true })
          .then((r) => r.stdout.trim()),
      ])

    const state = readRepoState(this.gitDir!)
    const currentBranch = branchName === 'HEAD' ? '(detached)' : branchName
    const origin = remotes.find((r) => r.name === 'origin')
    const upstreamBranch = branches.find((b) => b.isCurrent)?.upstream
    let ahead = 0
    let behind = 0
    if (upstreamBranch) {
      const ab = branches.find((b) => b.isCurrent)
      if (ab) {
        ahead = ab.ahead
        behind = ab.behind
      }
    }

    const authors = new AuthorRegistry()
    for (const c of commitsBundle.commits) {
      authors.resolve(c.author.name, c.author.email)
    }

    return {
      repository: {
        name: repoNameFromPath(cwd),
        path: cwd,
        gitVersion: this.gitVersion,
        currentBranch,
        detached: state.detachedHead,
        headSha: headSha || '',
        ahead,
        behind,
        remoteUrl: origin?.fetchUrl ?? '',
        remotes,
        state,
      },
      commits: commitsBundle.commits,
      page: commitsBundle.page,
      branches,
      tags,
      stashes,
      worktrees,
      workingTree,
      authors: authors.all(),
    }
  }

  async loadCommitPage(request: CommitPageRequest): Promise<CommitPageResult> {
    const cwd = this.requireRepo()
    const limit = request.limit ?? DEFAULT_COMMIT_LIMIT

    const skipResult = await gitCli.run(
      ['rev-list', '--count', `${request.beforeSha}^..HEAD`],
      { cwd, allowFailure: true },
    )
    const skip = Number(skipResult.stdout.trim()) || 0

    return this.loadCommits(cwd, limit, skip)
  }

  private async loadCommits(
    cwd: string,
    limit: number,
    skip: number,
  ): Promise<{ commits: WireRepositorySnapshot['commits']; page: WireRepositorySnapshot['page'] }> {
    const authors = new AuthorRegistry()
    const { stdout } = await gitCli.run(
      [
        'log',
        '--date=iso-strict',
        `--format=${LOG_FORMAT}`,
        '--decorate=full',
        '-n',
        String(limit),
        ...(skip > 0 ? ['--skip', String(skip)] : []),
      ],
      { cwd, timeout: 120_000 },
    )

    const commits = parseCommits(stdout, authors)
    const oldestSha = commits.length > 0 ? commits[commits.length - 1].sha : null

    const totalResult = await gitCli.run(['rev-list', '--count', 'HEAD'], { cwd, allowFailure: true })
    const total = Number(totalResult.stdout.trim()) || null
    const loaded = skip + commits.length
    const hasMore = total != null ? loaded < total : commits.length >= limit

    return {
      commits,
      page: { oldestSha, hasMore, total },
    }
  }

  private async loadBranches(cwd: string, favorites: Set<string>): Promise<WireRepositorySnapshot['branches']> {
    const cached = this.cache.getBranches()
    if (cached) return cached

    const { stdout } = await gitCli.run(
      ['for-each-ref', '--format=' + BRANCH_FORMAT, ...BRANCH_REFSPECS, '--sort=-committerdate'],
      { cwd },
    )
    const branches = parseBranches(stdout, favorites)
    this.cache.setBranches(branches)
    return branches
  }

  private async loadTags(cwd: string): Promise<WireRepositorySnapshot['tags']> {
    const { stdout } = await gitCli.run(['tag', '-l', '--format=' + TAG_FORMAT], { cwd, allowFailure: true })
    return parseTags(stdout)
  }

  private async loadStashes(cwd: string): Promise<WireRepositorySnapshot['stashes']> {
    const { stdout } = await gitCli.run(['stash', 'list', '--format=' + STASH_FORMAT], {
      cwd,
      allowFailure: true,
    })
    return parseStashes(stdout)
  }

  private async loadWorktrees(cwd: string): Promise<WireRepositorySnapshot['worktrees']> {
    const { stdout } = await gitCli.run(['worktree', 'list', '--porcelain'], { cwd, allowFailure: true })
    return parseWorktrees(stdout, cwd)
  }

  private async loadWorkingTree(cwd: string): Promise<WireRepositorySnapshot['workingTree']> {
    const cached = this.cache.getStatus()
    if (cached) return cached

    const [statusResult, stagedNumstat, unstagedNumstat] = await Promise.all([
      gitCli.run(['status', '--porcelain=v2', '-z', '-uall'], { cwd }),
      gitCli.run(['diff', '--cached', '--numstat', '-z'], { cwd, allowFailure: true }),
      gitCli.run(['diff', '--numstat', '-z'], { cwd, allowFailure: true }),
    ])

    const files = parseStatus({
      porcelain: statusResult.stdout,
      staged: parseNumstat(stagedNumstat.stdout),
      unstaged: parseNumstat(unstagedNumstat.stdout),
    })
    this.cache.setStatus(files)
    return files
  }

  async execute(action: GitAction): Promise<ActionEnvelope> {
    const cwd = this.requireRepo()
    const operationId = randomUUID()
    const controller = new AbortController()
    this.operations.set(operationId, { controller, kind: action.kind })

    const emit = (phase: string, percent: number | null, done = false): void => {
      this.hooks.onProgress?.({ operationId, kind: action.kind, phase, percent, done })
    }

    try {
      emit('Starting…', 0)
      const result = await executeGitAction(action, {
        cwd,
        signal: controller.signal,
        onProgress: (phase) => emit(phase, null),
      })

      if (result.ok && action.kind !== 'refresh') {
        this.cache.invalidate()
        this.hooks.onChanged?.({ path: cwd, scopes: scopesForAction(action.kind) })
      }

      emit('Done', 100, true)
      return result
    } finally {
      this.operations.delete(operationId)
    }
  }

  cancel(operationId: string): void {
    this.operations.get(operationId)?.controller.abort()
  }

  cancelActive(): void {
    for (const op of this.operations.values()) {
      op.controller.abort()
    }
  }

  async getDiff(request: DiffRequest): Promise<DiffResult> {
    const cwd = this.requireRepo()
    const path = request.path
    const maxBytes = 512 * 1024

    try {
      const stat = statSync(join(cwd, path))
      if (stat.size > maxBytes && !request.ignoreWhitespace) {
        return {
          path,
          binary: false,
          tooLarge: true,
          language: guessLanguage(path),
          hunks: [],
          additions: 0,
          deletions: 0,
        }
      }
    } catch {
      /* file may be deleted */
    }

    let args: string[]
    switch (request.source) {
      case 'index':
        args = ['diff', '--cached', '--', path]
        break
      case 'commit':
        args = ['show', request.sha ?? 'HEAD', '--', path]
        break
      case 'range':
        args = ['diff', request.sha ?? 'HEAD~1', request.toSha ?? 'HEAD', '--', path]
        break
      default:
        args = ['diff', '--', path]
    }
    if (request.ignoreWhitespace) args.splice(1, 0, '-w')

    const { stdout } = await gitCli.run(args, { cwd, allowFailure: true })
    return parseUnifiedDiff(path, stdout)
  }

  async search(query: SearchQuery): Promise<SearchResults> {
    const cwd = this.requireRepo()
    const text = query.text.trim()
    if (!text) return { commits: [], files: [] }

    const args = ['log', '--format=%H\x1f%s\x1f%an\x1f%at', '-n', String(query.limit ?? 50)]
    if (/^[0-9a-f]{4,40}$/i.test(text)) {
      args.push(text)
    } else if (query.regex) {
      args.push('--extended-regexp', `--grep=${text}`)
    } else {
      args.push('--grep=' + text)
    }
    if (query.fields?.includes('author')) args.push(`--author=${text}`)

    const { stdout } = await gitCli.run(args, { cwd, allowFailure: true })
    const commits = stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha, subject, author, at] = line.split('\x1f')
        return { sha, shortSha: sha.slice(0, 7), subject, author, date: new Date(Number(at) * 1000).toISOString() }
      })

    const filesResult = await gitCli.run(['ls-files'], { cwd, allowFailure: true })
    const needle = text.toLowerCase()
    const files = filesResult.stdout
      .split('\n')
      .filter((f) => f.toLowerCase().includes(needle))
      .slice(0, query.limit ?? 50)

    return { commits, files }
  }

  invalidateCache(scopes?: SnapshotScope[]): void {
    this.cache.invalidate(scopes)
  }

  private requireRepo(): string {
    if (!this.repoPath) {
      throw new GitError('RepositoryNotFound', 'No repository is open.')
    }
    if (!existsSync(this.repoPath)) {
      throw new GitError('RepositoryNotFound', 'The repository folder was deleted.')
    }
    return this.repoPath
  }
}

function scopesForAction(kind: string): SnapshotScope[] {
  if (kind.startsWith('reset') || kind.includes('rebase') || kind.includes('merge') || kind.includes('cherry')) {
    return ['commits', 'branches', 'status']
  }
  if (kind.includes('branch') || kind === 'checkout' || kind === 'checkout-commit' || kind === 'checkout-tag') {
    return ['commits', 'branches', 'status']
  }
  if (kind.includes('stage') || kind.includes('commit') || kind === 'stash' || kind.includes('discard')) {
    return ['status']
  }
  if (kind === 'fetch' || kind === 'pull' || kind === 'push' || kind === 'sync') {
    return ['branches', 'commits', 'status']
  }
  return ['status', 'branches', 'commits', 'tags', 'stashes']
}

function guessLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    vue: 'vue',
    css: 'css',
    json: 'json',
    md: 'markdown',
    py: 'python',
    go: 'go',
    rs: 'rust',
  }
  return map[ext] ?? 'plaintext'
}

export const gitProvider = new GitProvider()
