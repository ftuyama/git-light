/**
 * Row model for the commit graph list.
 *
 * Order (top to bottom): the optional uncommitted-changes (pending) row,
 * then commits newest-first with each stash inserted immediately above its
 * base commit (GitKraken-style). Stashes whose base commit is not loaded fall
 * back to the top of the commit list, right below the pending row.
 */

export type GraphRow =
  | { kind: 'pending' }
  | { kind: 'stash'; stashIndex: number }
  | { kind: 'commit'; commitIndex: number }

export function buildGraphRows(
  commits: { sha: string }[],
  hasPendingRow: boolean,
  stashes: { baseSha: string | null }[],
): GraphRow[] {
  const byBase = new Map<number, number[]>()
  const unanchored: number[] = []
  for (let i = 0; i < stashes.length; i++) {
    const baseSha = stashes[i].baseSha
    const baseIndex = baseSha ? commits.findIndex((c) => c.sha === baseSha) : -1
    if (baseIndex >= 0) {
      const list = byBase.get(baseIndex) ?? []
      list.push(i)
      byBase.set(baseIndex, list)
    } else {
      unanchored.push(i)
    }
  }

  const rows: GraphRow[] = []
  if (hasPendingRow) rows.push({ kind: 'pending' })
  for (const stashIndex of unanchored) rows.push({ kind: 'stash', stashIndex })
  for (let commitIndex = 0; commitIndex < commits.length; commitIndex++) {
    for (const stashIndex of byBase.get(commitIndex) ?? []) {
      rows.push({ kind: 'stash', stashIndex })
    }
    rows.push({ kind: 'commit', commitIndex })
  }
  return rows
}

/** Maps each commit index to its virtual row index. */
export function commitVirtualIndexByCommit(rows: GraphRow[]): Map<number, number> {
  const map = new Map<number, number>()
  rows.forEach((row, virtualIndex) => {
    if (row.kind === 'commit') map.set(row.commitIndex, virtualIndex)
  })
  return map
}

/** Maps each stash index to its virtual row index. */
export function stashVirtualIndexByStash(rows: GraphRow[]): Map<number, number> {
  const map = new Map<number, number>()
  rows.forEach((row, virtualIndex) => {
    if (row.kind === 'stash') map.set(row.stashIndex, virtualIndex)
  })
  return map
}
