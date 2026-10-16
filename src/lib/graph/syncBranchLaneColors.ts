import type { Branch, Commit } from '@/types/git'
import type { GraphLayout } from './computeGraphLayout'
import { buildCommitIndex } from './commitIndex'

export function laneIndexForBranchTip(
  branch: Branch,
  commits: Commit[],
  layout: GraphLayout,
  indexBySha?: Map<string, number>,
): number | null {
  const tipIndex = (indexBySha ?? buildCommitIndex(commits)).get(branch.tipSha) ?? -1
  if (tipIndex < 0) return null
  const lane = layout.nodes[tipIndex]?.lane
  return lane ?? null
}

/** Aligns branch sidebar dots with commit-graph lane colors. */
export function syncBranchLaneColors(
  branches: Branch[],
  commits: Commit[],
  layout: GraphLayout,
): Branch[] {
  if (layout.nodes.length === 0) return branches

  const indexBySha = buildCommitIndex(commits)
  return branches.map((branch) => {
    const lane = laneIndexForBranchTip(branch, commits, layout, indexBySha)
    if (lane === null) return branch
    if (branch.laneColorIndex === lane) return branch
    return { ...branch, laneColorIndex: lane }
  })
}
