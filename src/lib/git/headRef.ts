import type { Branch, Ref } from '@/types/git'
import type { WireBranch, WireRef } from '@shared/git/models'

/**
 * Detects symbolic HEAD refs that should not appear as chips in the
 * view (e.g. `HEAD`, `origin/HEAD`, `refs/remotes/origin/HEAD`).
 * The current branch is still indicated via `isHead` / `isCurrent`.
 */
export function isHeadSymbolicRef(ref: Pick<WireRef, 'type' | 'name' | 'label'> | Pick<Ref, 'type' | 'name' | 'label'>): boolean {
  if (ref.type === 'head') return true
  if (ref.label === 'HEAD') return true
  const name = ref.name ?? ''
  if (name === 'HEAD' || name.endsWith('/HEAD')) return true
  return false
}

/** Detects symbolic HEAD branches (e.g. remote `HEAD` from `origin/HEAD`). */
export function isHeadBranch(branch: Pick<WireBranch, 'name'> | Pick<Branch, 'name'>): boolean {
  return branch.name === 'HEAD' || branch.name.endsWith('/HEAD')
}
