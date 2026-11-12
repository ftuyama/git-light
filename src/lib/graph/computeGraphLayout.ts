import type { Commit } from '@/types/git'
import { laneColor } from '@/lib/utils'
import type { GraphEdgeKind } from './graphEdgePath'

export interface GraphEdge {
  fromLane: number
  toLane: number
  color: string
  kind: GraphEdgeKind
}

export interface GraphNode {
  sha: string
  row: number
  lane: number
  color: string
}

/** Lane expectations after the last processed row — used to extend layout incrementally. */
export interface GraphLaneState {
  lanes: (string | null)[]
}

export interface GraphLayout {
  /** Indexed by row (commits are newest-first). */
  nodes: GraphNode[]
  /** bands[i] holds the edge segments drawn in the band below row i. */
  bands: GraphEdge[][]
  maxLanes: number
  laneState?: GraphLaneState
}

/**
 * Color of an edge segment. Straight and merge segments belong to the lane they
 * target, but a convergence is the branch's own history reaching back into the
 * lane it forked from, so it keeps the straying lane's color.
 */
export function edgeColor(fromLane: number, toLane: number, kind: GraphEdgeKind): string {
  return laneColor(kind === 'converge' ? fromLane : toLane)
}

interface LaneContext {
  lanes: (string | null)[]
  /** Lanes carrying HEAD's first-parent chain, which wins a shared parent. */
  headLanes: boolean[]
  waitingShas: Set<string>
  setLane: (index: number, sha: string | null, headLane?: boolean) => void
  laneWaitingFor: (sha: string) => number
  firstFree: () => number
}

function createLaneContext(
  initialLanes?: (string | null)[],
  initialHeadLanes?: boolean[],
): LaneContext {
  const lanes = initialLanes ? [...initialLanes] : []
  const headLanes = initialLanes
    ? initialLanes.map((_, index) => initialHeadLanes?.[index] === true)
    : []
  const waitingShas = new Set<string>()
  for (const sha of lanes) {
    if (sha != null) waitingShas.add(sha)
  }

  const setLane = (index: number, sha: string | null, headLane = false): void => {
    const prev = lanes[index]
    if (prev != null) waitingShas.delete(prev)
    lanes[index] = sha
    headLanes[index] = sha != null && headLane
    if (sha != null) waitingShas.add(sha)
  }

  const laneWaitingFor = (sha: string): number => {
    let fallback = -1
    for (let j = 0; j < lanes.length; j++) {
      if (lanes[j] !== sha) continue
      // Several lanes can wait for the same shared parent. Keeping HEAD's lane
      // makes the checked-out branch run straight through the fork while other
      // branches curve into it.
      if (headLanes[j]) return j
      if (fallback === -1) fallback = j
    }
    return fallback
  }

  const firstFree = (): number => {
    const idx = lanes.indexOf(null)
    return idx === -1 ? lanes.length : idx
  }

  return { lanes, headLanes, waitingShas, setLane, laneWaitingFor, firstFree }
}

function assignNodes(
  commits: Commit[],
  startRow: number,
  ctx: LaneContext,
  nodes: GraphNode[],
  laneOf: Map<string, number>,
  headCommitIndex: number,
): number {
  let maxLanes = 0
  for (let i = 0; i < startRow; i++) {
    const node = nodes[i]
    if (node) maxLanes = Math.max(maxLanes, node.lane + 1)
  }

  for (let i = startRow; i < commits.length; i++) {
    const commit = commits[i]
    let myLane = ctx.laneWaitingFor(commit.sha)
    let onHeadChain = myLane !== -1 && ctx.headLanes[myLane]
    if (myLane === -1) {
      myLane = ctx.firstFree()
      if (myLane === ctx.lanes.length) ctx.lanes.push(null)
      ctx.setLane(myLane, commit.sha)
    }
    if (i === headCommitIndex) onHeadChain = true

    for (let j = 0; j < ctx.lanes.length; j++) {
      if (j !== myLane && ctx.lanes[j] === commit.sha) ctx.setLane(j, null)
    }

    laneOf.set(commit.sha, myLane)
    nodes[i] = { sha: commit.sha, row: i, lane: myLane, color: laneColor(myLane) }

    const parents = commit.parents
    if (parents.length === 0) {
      ctx.setLane(myLane, null)
    } else {
      ctx.setLane(myLane, parents[0], onHeadChain)
      for (let p = 1; p < parents.length; p++) {
        const parent = parents[p]
        if (!ctx.waitingShas.has(parent)) {
          const lane = ctx.firstFree()
          if (lane === ctx.lanes.length) ctx.lanes.push(null)
          ctx.setLane(lane, parent)
        }
      }
    }

    while (ctx.lanes.length > 0 && ctx.lanes[ctx.lanes.length - 1] === null) ctx.lanes.pop()
    maxLanes = Math.max(maxLanes, ctx.lanes.length)
  }

  return Math.max(maxLanes, 1)
}

function assignEdges(
  commits: Commit[],
  nodes: GraphNode[],
  laneOf: Map<string, number>,
  rowOf: Map<string, number>,
  bands: GraphEdge[][],
  seen: Set<string>[],
  startRow: number,
): void {
  const pushEdge = (
    band: number,
    fromLane: number,
    toLane: number,
    kind: GraphEdgeKind,
  ): void => {
    const key = `${fromLane}>${toLane}:${kind}`
    if (seen[band].has(key)) return
    seen[band].add(key)
    bands[band].push({ fromLane, toLane, color: edgeColor(fromLane, toLane, kind), kind })
  }

  for (let i = startRow; i < commits.length; i++) {
    const lc = nodes[i].lane
    const commit = commits[i]
    for (let pi = 0; pi < commit.parents.length; pi++) {
      const parent = commit.parents[pi]
      const rp = rowOf.get(parent)
      if (rp === undefined) continue
      const lp = laneOf.get(parent)!

      let kind: GraphEdgeKind = 'straight'
      if (lc !== lp) {
        // A merge's extra parents fan out; every other lane shift is the
        // branch stepping into the lane reserved by its shared parent.
        kind = commit.isMerge && pi > 0 ? 'merge' : 'converge'
      }

      if (kind === 'converge') {
        // Stay in the branch's own lane until the row where the shared parent
        // is reached, then turn into the parent lane. Drawing the diagonal
        // right below the branch tip would make the branch look like it forked
        // off the newest commit of the lane it actually rejoins much later.
        for (let r = i; r < rp - 1; r++) pushEdge(r, lc, lc, 'straight')
        pushEdge(rp - 1, lc, lp, 'converge')
        continue
      }

      // The edge itself already runs down the parent lane to the next row, so
      // band i needs no extra straight there: its butt cap would poke out
      // beside the corner radius and read as a second line following the arc.
      pushEdge(i, lc, lp, kind)
      for (let r = i + 1; r < rp; r++) pushEdge(r, lp, lp, 'straight')
    }
  }
}

function seedEdgeSeen(bands: GraphEdge[][]): Set<string>[] {
  return bands.map((band) => {
    const set = new Set<string>()
    for (const edge of band) {
      set.add(`${edge.fromLane}>${edge.toLane}:${edge.kind}`)
    }
    return set
  })
}

/**
 * Assigns commits to lanes (columns) and produces per-band edge segments for a
 * Multi-lane commit graph. Commits must be topologically sorted newest-first.
 * `headCommitIndex` keeps the checked-out branch's line straight through a
 * fork, so other branches are drawn curving into it.
 */
export function computeGraphLayout(commits: Commit[], headCommitIndex = -1): GraphLayout {
  const n = commits.length
  if (n === 0) {
    return { nodes: [], bands: [], maxLanes: 1, laneState: { lanes: [] } }
  }

  const rowOf = new Map<string, number>()
  for (let i = 0; i < n; i++) rowOf.set(commits[i].sha, i)

  const laneOf = new Map<string, number>()
  const nodes: GraphNode[] = new Array(n)
  const ctx = createLaneContext()
  const maxLanes = assignNodes(commits, 0, ctx, nodes, laneOf, headCommitIndex)

  const bands: GraphEdge[][] = Array.from({ length: n }, () => [])
  const seen = seedEdgeSeen(bands)
  assignEdges(commits, nodes, laneOf, rowOf, bands, seen, 0)

  return {
    nodes,
    bands,
    maxLanes,
    laneState: { lanes: [...ctx.lanes] },
  }
}

/**
 * Extends an existing layout with newly paginated commits without recomputing
 * earlier rows. Falls back to a full layout when lane state is unavailable.
 */
export function extendGraphLayout(
  existingCommits: Commit[],
  newCommits: Commit[],
  prevLayout: GraphLayout,
  headCommitIndex = -1,
): GraphLayout {
  if (newCommits.length === 0) return prevLayout

  const oldN = existingCommits.length
  if (
    !prevLayout.laneState ||
    prevLayout.nodes.length !== oldN ||
    prevLayout.bands.length !== oldN
  ) {
    return computeGraphLayout([...existingCommits, ...newCommits], headCommitIndex)
  }

  const commits = [...existingCommits, ...newCommits]
  const n = commits.length
  const rowOf = new Map<string, number>()
  for (let i = 0; i < n; i++) rowOf.set(commits[i].sha, i)

  const laneOf = new Map<string, number>()
  for (let i = 0; i < oldN; i++) {
    laneOf.set(prevLayout.nodes[i].sha, prevLayout.nodes[i].lane)
  }

  const nodes = [...prevLayout.nodes]
  nodes.length = n
  // The previous page was already remapped so HEAD sits in lane 0; its
  // first-parent chain continues in that lane as more commits arrive.
  const headLane = prevLayout.nodes[headCommitIndex]?.lane
  const headLanes = prevLayout.laneState.lanes.map((_, index) => index === headLane)
  const ctx = createLaneContext(prevLayout.laneState.lanes, headLanes)
  const maxLanes = Math.max(
    prevLayout.maxLanes,
    assignNodes(commits, oldN, ctx, nodes, laneOf, headCommitIndex),
  )

  // Edges are rebuilt from row 0 because a parent that was outside the previous
  // page has no edge yet: its straight run has to cross the bands already on
  // screen. Lane assignments are still reused, so only edge segments are redone.
  const bands: GraphEdge[][] = Array.from({ length: n }, () => [])
  const seen = seedEdgeSeen(bands)
  assignEdges(commits, nodes, laneOf, rowOf, bands, seen, 0)

  return {
    nodes,
    bands,
    maxLanes,
    laneState: { lanes: [...ctx.lanes] },
  }
}
