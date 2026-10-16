import type { Commit, Stash } from '@/types/git'

/** True when a graph filter query is active (non-blank). */
export function isGraphFiltering(query: string | null | undefined): boolean {
  return (query ?? '').trim().length > 0
}

function normalizedQuery(query: string): string {
  return query.trim().toLowerCase()
}

function refText(commit: Commit): string {
  return commit.refs
    .map((r) => `${r.label ?? ''} ${r.name ?? ''}`)
    .join(' ')
    .toLowerCase()
}

/** Local, synchronous matcher for dimming loaded commits while searching. */
export function commitMatchesFilter(commit: Commit, query: string): boolean {
  const needle = normalizedQuery(query)
  if (!needle) return true
  if (commit.sha.toLowerCase().includes(needle)) return true
  if (commit.shortSha.toLowerCase().includes(needle)) return true
  if (commit.subject.toLowerCase().includes(needle)) return true
  if (commit.body?.toLowerCase().includes(needle)) return true
  if (commit.author.name.toLowerCase().includes(needle)) return true
  if (commit.author.email.toLowerCase().includes(needle)) return true
  if (commit.committer.name.toLowerCase().includes(needle)) return true
  if (refText(commit).includes(needle)) return true
  return false
}

/** Local matcher for stash rows (branch, message, id, base subject). */
export function stashMatchesFilter(stash: Stash, query: string): boolean {
  const needle = normalizedQuery(query)
  if (!needle) return true
  if (stash.branch.toLowerCase().includes(needle)) return true
  if (stash.message.toLowerCase().includes(needle)) return true
  if (stash.baseSubject?.toLowerCase().includes(needle)) return true
  if (stash.baseSha?.toLowerCase().includes(needle)) return true
  if (`stash@{${stash.index}}`.includes(needle)) return true
  return false
}
