/**
 * Typed Git error taxonomy shared between the Tauri backend and the
 * renderer. The backend throws/normalizes these; the renderer reconstructs
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
}

