import { computeGraphLayout, type GraphLayout } from '@/lib/graph/computeGraphLayout'
import { remapHeadLaneToLeft } from '@/lib/graph/remapHeadLaneLeft'
import type { CommitPageInfo } from '@shared/git/models'
import type { Commit } from '@/types/git'

export const EMPTY_LAYOUT: GraphLayout = { nodes: [], bands: [], maxLanes: 1 }
export const EMPTY_PAGE: CommitPageInfo = { oldestSha: null, hasMore: false, total: null }

export function buildGraphLayout(commits: Commit[], headCommitIndex: number): GraphLayout {
  return remapHeadLaneToLeft(computeGraphLayout(commits), headCommitIndex)
}
