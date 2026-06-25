/**
 * Typed Git error taxonomy shared between the Electron main process and the
 * renderer. The main process throws/normalizes these; the renderer reconstructs
 * them from the serialized payload so the UI can show actionable messages
 * instead of raw stderr.
 */
export type GitErrorCode =
  | 'MergeConflict'
  | 'Authentication'
  | 'RepositoryNotFound'
  | 'NotARepository'
  | 'BareRepository'
  | 'DetachedHead'
  | 'RemoteRejected'
  | 'NothingToCommit'
  | 'Network'
  | 'DirtyWorktree'
  | 'Cancelled'
  | 'Unknown'

export interface SerializedGitError {
  __gitError: true
  code: GitErrorCode
  message: string
  /** Human-readable, parsed detail (never raw multi-line stderr dumps). */
  detail?: string
  /** Files involved, e.g. conflicted paths. */
  files?: string[]
}

export class GitError extends Error {
  readonly code: GitErrorCode
  readonly detail?: string
  readonly files?: string[]

  constructor(code: GitErrorCode, message: string, options: { detail?: string; files?: string[] } = {}) {
    super(message)
    this.name = 'GitError'
    this.code = code
    this.detail = options.detail
    this.files = options.files
  }

  serialize(): SerializedGitError {
    return {
      __gitError: true,
      code: this.code,
      message: this.message,
      detail: this.detail,
      files: this.files,
    }
  }

  static is(value: unknown): value is SerializedGitError {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value as { __gitError?: unknown }).__gitError === true
    )
  }
}

const DEFAULT_MESSAGES: Record<GitErrorCode, string> = {
  MergeConflict: 'The operation produced merge conflicts that need to be resolved.',
  Authentication: 'Authentication failed. Check your SSH keys or credential manager.',
  RepositoryNotFound: 'The repository could not be found.',
  NotARepository: 'This folder is not a Git repository.',
  BareRepository: 'Bare repositories are not supported.',
  DetachedHead: 'HEAD is detached.',
  RemoteRejected: 'The remote rejected the push.',
  NothingToCommit: 'There are no staged changes to commit.',
  Network: 'A network error occurred while contacting the remote.',
  DirtyWorktree: 'You have uncommitted changes that would be overwritten.',
  Cancelled: 'The operation was cancelled.',
  Unknown: 'An unexpected Git error occurred.',
}

/**
 * Best-effort classification of git stderr into a typed error. Keeps the raw
 * detail trimmed to the most relevant line for display.
 */
export function classifyGitError(stderr: string, exitCode: number | null): GitError {
  const text = (stderr ?? '').trim()
  const lower = text.toLowerCase()
  const firstLine = text.split('\n').find((line) => line.trim().length > 0)?.trim()

  const make = (code: GitErrorCode, files?: string[]): GitError =>
    new GitError(code, DEFAULT_MESSAGES[code], { detail: firstLine, files })

  if (
    lower.includes('could not read username') ||
    lower.includes('authentication failed') ||
    lower.includes('permission denied (publickey)') ||
    lower.includes('host key verification failed')
  ) {
    return make('Authentication')
  }
  if (
    lower.includes('conflict') &&
    (lower.includes('merge') || lower.includes('automatic') || lower.includes('cherry-pick') || lower.includes('rebase'))
  ) {
    const files = extractConflictFiles(text)
    return make('MergeConflict', files.length ? files : undefined)
  }
  if (lower.includes('nothing to commit') || lower.includes('no changes added to commit')) {
    return make('NothingToCommit')
  }
  if (lower.includes('rejected') && lower.includes('non-fast-forward')) {
    return make('RemoteRejected')
  }
  if (lower.includes('failed to push')) {
    return make('RemoteRejected')
  }
  if (
    lower.includes('could not resolve host') ||
    lower.includes('connection timed out') ||
    lower.includes('network is unreachable')
  ) {
    return make('Network')
  }
  if (
    lower.includes('would be overwritten') ||
    lower.includes('your local changes') ||
    lower.includes('please commit your changes or stash')
  ) {
    return make('DirtyWorktree')
  }
  if (lower.includes('not a git repository')) {
    return make('NotARepository')
  }

  return new GitError('Unknown', firstLine || DEFAULT_MESSAGES.Unknown, {
    detail: exitCode != null ? `git exited with code ${exitCode}` : undefined,
  })
}

function extractConflictFiles(text: string): string[] {
  const files = new Set<string>()
  const re = /^(?:CONFLICT \([^)]*\): Merge conflict in |Auto-merging )(.+)$/gm
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    files.add(match[1].trim())
  }
  return [...files]
}
