import type { Branch, Ref } from '@/types/git'
import type { WireBranch, WireRef } from '@shared/git/models'

/**
 * Detecta refs simbólicas do HEAD que não devem aparecer como chips na
 * visualização (ex.: `HEAD`, `origin/HEAD`, `refs/remotes/origin/HEAD`).
 * A branch atual continua indicada via `isHead` / `isCurrent`.
 */
export function isHeadSymbolicRef(ref: Pick<WireRef, 'type' | 'name' | 'label'> | Pick<Ref, 'type' | 'name' | 'label'>): boolean {
  if (ref.type === 'head') return true
  if (ref.label === 'HEAD') return true
  const name = ref.name ?? ''
  if (name === 'HEAD' || name.endsWith('/HEAD')) return true
  return false
}

/** Detecta branches simbólicas do HEAD (ex.: remote `HEAD` de `origin/HEAD`). */
export function isHeadBranch(branch: Pick<WireBranch, 'name'> | Pick<Branch, 'name'>): boolean {
  return branch.name === 'HEAD' || branch.name.endsWith('/HEAD')
}
