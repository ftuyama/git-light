import {
  computeGraphLayout,
  extendGraphLayout,
  type GraphLayout,
} from '@/lib/graph/computeGraphLayout'
import { remapHeadLaneToLeft } from '@/lib/graph/remapHeadLaneLeft'
import { perfSync } from '@shared/perf'
import type { CommitPageInfo } from '@shared/git/models'
import type { Commit } from '@/types/git'

export const EMPTY_LAYOUT: GraphLayout = { nodes: [], bands: [], maxLanes: 1 }
export const EMPTY_PAGE: CommitPageInfo = { oldestSha: null, hasMore: false, total: null }

export function buildGraphLayout(commits: Commit[], headCommitIndex: number): GraphLayout {
  return perfSync(`buildGraphLayout(${commits.length})`, () =>
    remapHeadLaneToLeft(computeGraphLayout(commits), headCommitIndex),
  )
}

export function appendGraphLayout(
  existingCommits: Commit[],
  newCommits: Commit[],
  prevLayout: GraphLayout,
  headCommitIndex: number,
): GraphLayout {
  return perfSync(`appendGraphLayout(+${newCommits.length})`, () => {
    const base =
      newCommits.length === 0
        ? prevLayout
        : extendGraphLayout(existingCommits, newCommits, prevLayout)
    return remapHeadLaneToLeft(base, headCommitIndex)
  })
}
