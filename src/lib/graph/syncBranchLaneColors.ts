import type { Branch, Commit } from '@/types/git'
import type { GraphLayout } from './computeGraphLayout'

export function laneIndexForBranchTip(
  branch: Branch,
  commits: Commit[],
  layout: GraphLayout,
): number | null {
  const tipIndex = commits.findIndex((commit) => commit.sha === branch.tipSha)
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

  return branches.map((branch) => {
    const lane = laneIndexForBranchTip(branch, commits, layout)
    if (lane === null) return branch
    if (branch.laneColorIndex === lane) return branch
    return { ...branch, laneColorIndex: lane }
  })
}
