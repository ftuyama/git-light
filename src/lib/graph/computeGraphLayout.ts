import type { Commit } from '@/types/git'
import { laneColor } from '@/lib/utils'

export interface GraphEdge {
  fromLane: number
  toLane: number
  color: string
}

export interface GraphNode {
  sha: string
  row: number
  lane: number
  color: string
}

export interface GraphLayout {
  /** Indexed by row (commits are newest-first). */
  nodes: GraphNode[]
  /** bands[i] holds the edge segments drawn in the band below row i. */
  bands: GraphEdge[][]
  maxLanes: number
}

/**
 * Assigns commits to lanes (columns) and produces per-band edge segments for a
 * GitKraken-style graph. Commits must be topologically sorted newest-first.
 *
 * The algorithm walks rows top-to-bottom maintaining an array of "expected"
 * SHAs per lane. A commit claims the leftmost lane expecting it (or a fresh
 * lane if it is a branch tip). Its first parent continues in the same lane;
 * additional (merge) parents reserve new lanes. Edges fan out directly below a
 * commit and then run vertically down their parent's lane.
 */
export function computeGraphLayout(commits: Commit[]): GraphLayout {
  const n = commits.length
  const rowOf = new Map<string, number>()
  for (let i = 0; i < n; i++) rowOf.set(commits[i].sha, i)

  const laneOf = new Map<string, number>()
  const nodes: GraphNode[] = new Array(n)
  const lanes: (string | null)[] = []
  let maxLanes = 0

  const firstFree = (): number => {
    const idx = lanes.indexOf(null)
    return idx === -1 ? lanes.length : idx
  }

  for (let i = 0; i < n; i++) {
    const commit = commits[i]
    let myLane = lanes.indexOf(commit.sha)
    if (myLane === -1) {
      myLane = firstFree()
      lanes[myLane] = commit.sha
    }

    // Converging branches: free any other lane that was waiting for this commit.
    for (let j = 0; j < lanes.length; j++) {
      if (j !== myLane && lanes[j] === commit.sha) lanes[j] = null
    }

    laneOf.set(commit.sha, myLane)
    nodes[i] = { sha: commit.sha, row: i, lane: myLane, color: laneColor(myLane) }

    const parents = commit.parents
    if (parents.length === 0) {
      lanes[myLane] = null
    } else {
      lanes[myLane] = parents[0]
      for (let p = 1; p < parents.length; p++) {
        const parent = parents[p]
        if (lanes.indexOf(parent) === -1) {
          lanes[firstFree()] = parent
        }
      }
    }

    // Trim trailing free lanes to keep the graph compact.
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop()
    maxLanes = Math.max(maxLanes, lanes.length)
  }

  const bands: GraphEdge[][] = Array.from({ length: n }, () => [])
  const seen: Set<string>[] = Array.from({ length: n }, () => new Set())

  const pushEdge = (band: number, fromLane: number, toLane: number): void => {
    const key = `${fromLane}>${toLane}`
    if (seen[band].has(key)) return
    seen[band].add(key)
    bands[band].push({ fromLane, toLane, color: laneColor(toLane) })
  }

  for (let i = 0; i < n; i++) {
    const lc = nodes[i].lane
    for (const parent of commits[i].parents) {
      const rp = rowOf.get(parent)
      if (rp === undefined) continue
      const lp = laneOf.get(parent)!
      pushEdge(i, lc, lp)
      for (let r = i + 1; r < rp; r++) pushEdge(r, lp, lp)
    }
  }

  return { nodes, bands, maxLanes: Math.max(maxLanes, 1) }
}
