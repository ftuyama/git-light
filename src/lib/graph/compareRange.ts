import type { Commit } from '@/types/git'

export interface CompareRange {
  fromSha: string
  toSha: string
  fromShortSha: string
  toShortSha: string
}

/** Older commit is `fromSha`, newer is `toSha` (graph lists newest first). */
export function normalizeCompareRange(
  shaA: string,
  shaB: string,
  commits: Commit[],
): CompareRange {
  const idxA = commits.findIndex((c) => c.sha === shaA)
  const idxB = commits.findIndex((c) => c.sha === shaB)
  const commitA = commits[idxA]
  const commitB = commits[idxB]
  const olderFirst = idxA > idxB
  const from = olderFirst ? commitA : commitB
  const to = olderFirst ? commitB : commitA
  return {
    fromSha: from?.sha ?? shaA,
    toSha: to?.sha ?? shaB,
    fromShortSha: from?.shortSha ?? shaA.slice(0, 7),
    toShortSha: to?.shortSha ?? shaB.slice(0, 7),
  }
}
