import { existsSync, statSync } from 'node:fs'
import { basename, isAbsolute, normalize, resolve } from 'node:path'
import { GitError } from '@shared/git/errors'

/** Resolve and validate an absolute repository working-tree path. */
export function resolveRepoPath(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new GitError('RepositoryNotFound', 'No repository path provided.')
  }
  if (input.includes('\0')) {
    throw new GitError('RepositoryNotFound', 'Invalid repository path.')
  }

  const resolved = resolve(normalize(isAbsolute(input) ? input : resolve(process.cwd(), input)))

  if (!existsSync(resolved)) {
    throw new GitError('RepositoryNotFound', 'The folder does not exist.', { detail: resolved })
  }

  const stat = statSync(resolved)
  if (!stat.isDirectory()) {
    throw new GitError('RepositoryNotFound', 'The path is not a directory.', { detail: resolved })
  }

  return resolved
}

export function repoNameFromPath(path: string): string {
  return basename(path) || path
}

/** Reject relative paths that escape the repository root via `..` segments. */
export function assertPathInsideRepo(repoRoot: string, relativePath: string): string {
  const normalized = normalize(relativePath.replace(/^\.\/+/, ''))
  if (normalized.startsWith('..') || normalized.includes('/../')) {
    throw new GitError('Unknown', 'Path escapes the repository root.')
  }
  const full = resolve(repoRoot, normalized)
  if (!full.startsWith(repoRoot)) {
    throw new GitError('Unknown', 'Path escapes the repository root.')
  }
  return normalized
}
