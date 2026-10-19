/**
 * Repository path comparisons must not depend on the exact string the user
 * picked. The backend canonicalizes paths (resolving macOS `/private`/`/var`
 * prefixes, trailing slashes, case differences), while tabs and settings may
 * store the raw picked path. These helpers keep frontend comparisons tolerant
 * so a repo opened under one spelling still matches its canonical form.
 */
export function normalizeRepoPath(path: string): string {
  return path.replace(/\/+$/, '')
}

export function sameRepoPath(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  const na = normalizeRepoPath(a)
  const nb = normalizeRepoPath(b)
  return na === nb || na.toLowerCase() === nb.toLowerCase()
}
