/** Virtual row helpers when an uncommitted-changes row sits above all commits. */

export const PENDING_ROW_VIRTUAL_INDEX = 0

export function headCommitIndex(
  commits: { sha: string; refs: { isHead?: boolean }[] }[],
  headSha?: string,
): number {
  if (headSha) {
    const bySha = commits.findIndex((c) => c.sha === headSha)
    if (bySha >= 0) return bySha
  }
  return commits.findIndex((c) => c.refs.some((r) => r.isHead))
}

export function virtualRowCount(commitCount: number, hasPendingRow: boolean): number {
  return commitCount + (hasPendingRow ? 1 : 0)
}

/** Maps a virtual list index to a commit index, or `null` for the pending row. */
export function commitIndexForVirtual(
  virtualIndex: number,
  hasPendingRow: boolean,
): number | null {
  if (!hasPendingRow) return virtualIndex
  if (virtualIndex === PENDING_ROW_VIRTUAL_INDEX) return null
  return virtualIndex - 1
}

/** Maps a commit index to its virtual list index. */
export function virtualIndexForCommit(commitIndex: number, hasPendingRow: boolean): number {
  return hasPendingRow ? commitIndex + 1 : commitIndex
}
