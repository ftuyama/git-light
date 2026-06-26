import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { GitAction } from '@shared/git/actions'
import { GitError } from '@shared/git/errors'
import type {
  ActionEnvelope,
  CommitPageRequest,
  CommitPageResult,
  ConflictRequest,
  ConflictResult,
  DiffRequest,
  DiffResult,
  GraphScope,
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
import type { RebaseCommitsRequest, RebaseCommitsResult } from '@shared/git/rebase'
import { gitCli } from './GitCliProvider'
import { executeGitAction } from './ActionRouter'
import { ReflogJournal } from './ReflogJournal'
import { isJournalableAction, journalCaptureFor, journalLabel } from '@shared/git/undoPolicy'
import { RepoCache } from './RepoCache'
import { repoNameFromPath, resolveRepoPath, assertPathInsideRepo } from './pathUtils'
import { AuthorRegistry } from './parsers/authors'
import { parseBranches, BRANCH_FORMAT, BRANCH_REFSPECS } from './parsers/branchParser'
import { parseCommits, LOG_FORMAT } from './parsers/logParser'
import { parseRemotes, parseTags, TAG_FORMAT } from './parsers/refParser'
import { parseNumstat, parseStatus } from './parsers/statusParser'
import { parseCommitFiles } from './parsers/commitFilesParser'
import { parseStashes, STASH_FORMAT } from './parsers/stashParser'
import { readRepoState } from './parsers/stateParser'
import { parseWorktrees } from './parsers/worktreeParser'
import { parseUnifiedDiff } from './parsers/diffParser'
import { parseConflictMarkers } from './parsers/conflictParser'
import { parseRebaseCommits, REBASE_LOG_FORMAT } from './parsers/rebaseCommitsParser'

const DEFAULT_COMMIT_LIMIT = 100

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
  private journal = new ReflogJournal()
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
      this.journal.clear()
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
    this.journal.clear()
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

    const graphScope = options.graphScope ?? 'all'
    const commitLimit = options.commitLimit ?? DEFAULT_COMMIT_LIMIT

    if (need('commits') && options.invalidateCommits) {
      this.cache.invalidate(['commits'])
    }

    const [commitsBundle, branches, tags, stashes, worktrees, workingTree, remotes, branchName, gitIdentity] =
      await Promise.all([
        need('commits')
          ? this.loadCommits(cwd, commitLimit, graphScope, headSha || 'empty')
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
        this.loadGitIdentity(cwd),
      ])

    const state = readRepoState(this.gitDir!)
    const undoState = this.journal.getState(state)
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
    const commitAuthor = authors.resolve(gitIdentity.name, gitIdentity.email)

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
        canUndo: undoState.canUndo,
        canRedo: undoState.canRedo,
        undoLabel: undoState.undoLabel,
        redoLabel: undoState.redoLabel,
      },
      commits: commitsBundle.commits,
      page: commitsBundle.page,
      branches,
      tags,
      stashes,
      worktrees,
      workingTree,
      authors: authors.all(),
      commitAuthor,
    }
  }

  private async loadGitIdentity(cwd: string): Promise<{ name: string; email: string }> {
    const [nameResult, emailResult] = await Promise.all([
      gitCli.run(['config', 'user.name'], { cwd, allowFailure: true }),
      gitCli.run(['config', 'user.email'], { cwd, allowFailure: true }),
    ])
    return {
      name: nameResult.stdout.trim(),
      email: emailResult.stdout.trim(),
    }
  }

  async loadCommitPage(request: CommitPageRequest): Promise<CommitPageResult> {
    const cwd = this.requireRepo()
    const limit = request.limit ?? DEFAULT_COMMIT_LIMIT
    const graphScope = request.graphScope ?? 'all'
    return this.loadCommitsOlderThan(cwd, limit, graphScope, request.beforeSha)
  }

  private async loadCommitsOlderThan(
    cwd: string,
    limit: number,
    graphScope: GraphScope,
    beforeSha: string,
  ): Promise<{ commits: WireRepositorySnapshot['commits']; page: WireRepositorySnapshot['page'] }> {
    const { commits, hasMore } = await this.fetchCommitLog(cwd, limit, graphScope, `${beforeSha}^`)
    const oldestSha = commits.length > 0 ? commits[commits.length - 1].sha : null
    return {
      commits,
      page: { oldestSha, hasMore, total: null },
    }
  }

  private async loadCommits(
    cwd: string,
    limit: number,
    graphScope: GraphScope,
    headSha: string,
  ): Promise<{ commits: WireRepositorySnapshot['commits']; page: WireRepositorySnapshot['page'] }> {
    const cached = this.cache.getCommits(headSha, graphScope, limit)
    if (cached) return cached

    const { commits, hasMore } = await this.fetchCommitLog(cwd, limit, graphScope)
    const oldestSha = commits.length > 0 ? commits[commits.length - 1].sha : null

    const bundle = {
      commits,
      page: { oldestSha, hasMore, total: null },
    }
    this.cache.setCommits(headSha, graphScope, limit, bundle)
    return bundle
  }

  private async fetchCommitLog(
    cwd: string,
    limit: number,
    graphScope: GraphScope,
    endRev?: string,
  ): Promise<{ commits: WireRepositorySnapshot['commits']; hasMore: boolean }> {
    const authors = new AuthorRegistry()
    const fetchLimit = limit + 1
    const args = [
      'log',
      '--date=iso-strict',
      `--format=${LOG_FORMAT}`,
      '--decorate=full',
      '-n',
      String(fetchLimit),
    ]
    if (graphScope === 'all') args.splice(1, 0, '--all')
    if (endRev) args.push(endRev)

    const { stdout } = await gitCli.run(args, { cwd, timeout: 120_000, allowFailure: !!endRev })

    const allCommits = parseCommits(stdout, authors)
    const hasMore = allCommits.length > limit
    const commits = hasMore ? allCommits.slice(0, limit) : allCommits
    return { commits, hasMore }
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
    const repoState = this.gitDir ? readRepoState(this.gitDir) : undefined
    const captureKind = journalCaptureFor(action.kind)
    let checkpoint = null
    if (captureKind && repoState) {
      try {
        checkpoint = await this.journal.capture(cwd, captureKind, controller.signal)
      } catch {
        checkpoint = null
      }
    }

    const emit = (phase: string, percent: number | null, done = false): void => {
      this.hooks.onProgress?.({ operationId, kind: action.kind, phase, percent, done })
    }

    try {
      emit('Starting…', 0)
      const result = await executeGitAction(action, {
        cwd,
        signal: controller.signal,
        onProgress: (phase) => emit(phase, null),
        journal: this.journal,
        repoState,
      })

      if (result.ok && checkpoint && isJournalableAction(action.kind)) {
        this.journal.pushUndo(checkpoint, journalLabel(action))
      }

      if (result.ok) {
        const scopes = scopesForAction(action.kind)
        this.cache.invalidate(scopes)
        if (action.kind !== 'refresh') {
          this.hooks.onChanged?.({ path: cwd, scopes })
        }
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

  private async commitParentCount(sha: string, cwd: string): Promise<number> {
    const { stdout } = await gitCli.run(['rev-list', '--parents', '-n', '1', sha], {
      cwd,
      allowFailure: true,
    })
    const parts = stdout.trim().split(/\s+/).filter(Boolean)
    return Math.max(0, parts.length - 1)
  }

  async getCommitFiles(sha: string): Promise<WireRepositorySnapshot['workingTree']> {
    const cwd = this.requireRepo()
    const parentCount = await this.commitParentCount(sha, cwd)
    const hasParent = parentCount > 0
    // -m is required for merge commits; diff-tree without it returns nothing.
    const treeArgs = hasParent
      ? ['diff-tree', '--no-commit-id', '--name-status', '-z', '-r', '-m', sha]
      : ['diff-tree', '--root', '--no-commit-id', '--name-status', '-z', '-r', sha]
    const numstatArgs = hasParent
      ? ['diff-tree', '--no-commit-id', '--numstat', '-z', '-r', '-m', sha]
      : ['diff-tree', '--root', '--no-commit-id', '--numstat', '-z', '-r', sha]
    const [nameStatus, numstat] = await Promise.all([
      gitCli.run(treeArgs, { cwd, allowFailure: true }),
      gitCli.run(numstatArgs, { cwd, allowFailure: true }),
    ])
    return parseCommitFiles(nameStatus.stdout, numstat.stdout)
  }

  async getCompareFiles(fromSha: string, toSha: string): Promise<WireRepositorySnapshot['workingTree']> {
    const cwd = this.requireRepo()
    const range = `${fromSha}..${toSha}`
    const [nameStatus, numstat] = await Promise.all([
      gitCli.run(['diff', '--name-status', '-z', range], { cwd, allowFailure: true }),
      gitCli.run(['diff', '--numstat', '-z', range], { cwd, allowFailure: true }),
    ])
    return parseCommitFiles(nameStatus.stdout, numstat.stdout)
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
      case 'commit': {
        const sha = request.sha ?? 'HEAD'
        const parentCount = await this.commitParentCount(sha, cwd)
        if (parentCount > 1) {
          args = ['diff', '-m', '--first-parent', `${sha}^1`, sha, '--', path]
        } else if (parentCount > 0) {
          args = ['diff', `${sha}^`, sha, '--', path]
        } else {
          args = ['show', sha, '--', path]
        }
        break
      }
      case 'range':
        args = ['diff', request.sha ?? 'HEAD~1', request.toSha ?? 'HEAD', '--', path]
        break
      default:
        await this.ensureIntentToAdd(cwd, path)
        args = ['diff', '--', path]
    }
    if (request.ignoreWhitespace) args.splice(1, 0, '-w')

    const { stdout } = await gitCli.run(args, { cwd, allowFailure: true })
    return parseUnifiedDiff(path, stdout)
  }

  async getConflict(request: ConflictRequest): Promise<ConflictResult> {
    const cwd = this.requireRepo()
    const safePath = assertPathInsideRepo(cwd, request.path)
    const fullPath = join(cwd, safePath)

    try {
      const stat = statSync(fullPath)
      if (stat.size > 512 * 1024) {
        return emptyConflictResult(safePath, true)
      }
    } catch {
      return emptyConflictResult(safePath, false)
    }

    let content: string
    try {
      content = readFileSync(fullPath, 'utf8')
    } catch {
      return emptyConflictResult(safePath, false)
    }

    if (content.includes('\0')) {
      return emptyConflictResult(safePath, true)
    }

    const parsed = parseConflictMarkers(content)
    const [base, ours, theirs] = await Promise.all([
      readStageVersion(cwd, 1, safePath),
      readStageVersion(cwd, 2, safePath),
      readStageVersion(cwd, 3, safePath),
    ])

    return {
      path: safePath,
      binary: false,
      hasMarkers: parsed.hasMarkers,
      blocks: parsed.blocks,
      versions: { base, ours, theirs },
    }
  }

  async getRebaseCommits(request: RebaseCommitsRequest): Promise<RebaseCommitsResult> {
    const cwd = this.requireRepo()
    const base = request.base.trim()
    if (!base) throw new GitError('Unknown', 'No base ref specified.')

    const baseResult = await gitCli.run(['rev-parse', '--short', base], { cwd, allowFailure: true })
    if (baseResult.exitCode !== 0) {
      throw new GitError('Unknown', `Could not resolve base ref "${base}".`)
    }

    const { stdout } = await gitCli.run(
      ['log', '--reverse', `--format=${REBASE_LOG_FORMAT}`, `${base}..HEAD`],
      { cwd, allowFailure: true },
    )
    const commits = parseRebaseCommits(stdout)
    if (commits.length === 0) {
      throw new GitError('Unknown', `No commits between ${base} and HEAD.`)
    }

    return {
      base,
      baseShortSha: baseResult.stdout.trim(),
      commits,
    }
  }

  async search(query: SearchQuery): Promise<SearchResults> {
    const cwd = this.requireRepo()
    const text = query.text.trim()
    if (!text) return { commits: [], files: [] }

    const args = ['log', '--format=%H\x1f%s\x1f%an\x1f%at', '-n', String(query.limit ?? 50)]
    if (query.graphScope === 'all') args.splice(1, 0, '--all')
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

  /** Intent-to-add so untracked files appear in `git diff` for partial staging. */
  private async ensureIntentToAdd(cwd: string, path: string): Promise<void> {
    const tracked = await gitCli.run(['ls-files', '--error-unmatch', '--', path], {
      cwd,
      allowFailure: true,
    })
    if (tracked.exitCode === 0) return
    await gitCli.run(['add', '-N', '--', path], { cwd, allowFailure: true })
  }
}

function scopesForAction(kind: string): SnapshotScope[] {
  if (kind.startsWith('reset') || kind.includes('rebase') || kind.includes('merge') || kind.includes('cherry')) {
    return ['commits', 'branches', 'status']
  }
  if (kind.includes('branch') || kind === 'checkout' || kind === 'checkout-commit' || kind === 'checkout-tag') {
    return ['commits', 'branches', 'status']
  }
  if (kind === 'commit' || kind === 'amend' || kind === 'commit-and-push' || kind === 'commit-and-force-push') {
    return ['commits', 'status']
  }
  if (kind.includes('stage') || kind === 'stash' || kind.includes('discard') || kind.includes('conflict')) {
    return ['status']
  }
  if (kind === 'fetch' || kind === 'pull' || kind === 'push' || kind === 'sync' || kind === 'fetch-all') {
    return ['branches', 'commits', 'status']
  }
  if (kind === 'refresh') {
    return ['commits', 'branches', 'status', 'tags', 'stashes', 'worktrees']
  }
  if (kind === 'undo' || kind === 'redo') {
    return ['commits', 'branches', 'status']
  }
  return ['status', 'branches']
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

async function readStageVersion(cwd: string, stage: number, path: string): Promise<string | null> {
  const { stdout, exitCode } = await gitCli.run(['show', `:${stage}:${path}`], {
    cwd,
    allowFailure: true,
  })
  if (exitCode !== 0 || !stdout) return null
  return stdout
}

function emptyConflictResult(path: string, binary: boolean): ConflictResult {
  return {
    path,
    binary,
    hasMarkers: false,
    blocks: [],
    versions: { base: null, ours: null, theirs: null },
  }
}

export const gitProvider = new GitProvider()
