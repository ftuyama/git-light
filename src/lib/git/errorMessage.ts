import type { GitErrorCode } from '@shared/git/errors'
import { GitError } from '@shared/git/errors'
import { translate } from '@/locales'

/**
 * Human-readable, localized message for a git failure.
 *
 * The backend sends a stable `code` plus an English `message`; the renderer
 * translates the code and only falls back to the raw message when the code is
 * unknown (raw stderr detail is always shown as-is — it is diagnostic output).
 */
export function localizedGitErrorMessage(error: unknown, fallback?: string): string {
  const code = gitErrorCode(error)
  if (code) {
    const key = `errors.${code}`
    const localized = translate(key)
    if (localized && localized !== key) return localized
  }
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback ?? translate('common.state.error')
}

function gitErrorCode(error: unknown): GitErrorCode | null {
  if (error instanceof GitError) return error.code
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; errorCode?: unknown }
    const code = candidate.code ?? candidate.errorCode
    if (typeof code === 'string' && KNOWN_CODES.has(code as GitErrorCode)) {
      return code as GitErrorCode
    }
  }
  return null
}

const KNOWN_CODES = new Set<GitErrorCode>([
  'MergeConflict',
  'Authentication',
  'RepositoryNotFound',
  'NotARepository',
  'BareRepository',
  'DetachedHead',
  'RemoteRejected',
  'NothingToCommit',
  'Network',
  'DirtyWorktree',
  'Cancelled',
  'Unknown',
])
