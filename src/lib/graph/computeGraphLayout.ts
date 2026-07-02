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

interface LaneContext {
  lanes: (string | null)[]
  waitingShas: Set<string>
  setLane: (index: number, sha: string | null) => void
  laneWaitingFor: (sha: string) => number
  firstFree: () => number
}

function createLaneContext(initialLanes?: (string | null)[]): LaneContext {
  const lanes = initialLanes ? [...initialLanes] : []
  const waitingShas = new Set<string>()
  for (const sha of lanes) {
    if (sha != null) waitingShas.add(sha)
  }

  const setLane = (index: number, sha: string | null): void => {
    const prev = lanes[index]
    if (prev != null) waitingShas.delete(prev)
    lanes[index] = sha
    if (sha != null) waitingShas.add(sha)
  }

  const laneWaitingFor = (sha: string): number => {
    for (let j = 0; j < lanes.length; j++) {
      if (lanes[j] === sha) return j
    }
    return -1
  }

  const firstFree = (): number => {
    const idx = lanes.indexOf(null)
    return idx === -1 ? lanes.length : idx
  }

  return { lanes, waitingShas, setLane, laneWaitingFor, firstFree }
}

function assignNodes(
  commits: Commit[],
  startRow: number,
  ctx: LaneContext,
  nodes: GraphNode[],
  laneOf: Map<string, number>,
): number {
  let maxLanes = 0
  for (let i = 0; i < startRow; i++) {
    const node = nodes[i]
    if (node) maxLanes = Math.max(maxLanes, node.lane + 1)
  }

  for (let i = startRow; i < commits.length; i++) {
    const commit = commits[i]
    let myLane = ctx.laneWaitingFor(commit.sha)
    if (myLane === -1) {
      myLane = ctx.firstFree()
      if (myLane === ctx.lanes.length) ctx.lanes.push(null)
      ctx.setLane(myLane, commit.sha)
    }

    for (let j = 0; j < ctx.lanes.length; j++) {
      if (j !== myLane && ctx.lanes[j] === commit.sha) ctx.setLane(j, null)
    }

    laneOf.set(commit.sha, myLane)
    nodes[i] = { sha: commit.sha, row: i, lane: myLane, color: laneColor(myLane) }

    const parents = commit.parents
    if (parents.length === 0) {
      ctx.setLane(myLane, null)
    } else {
      ctx.setLane(myLane, parents[0])
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
    const key = `${fromLane}>${toLane}`
    if (seen[band].has(key)) return
    seen[band].add(key)
    bands[band].push({ fromLane, toLane, color: laneColor(toLane), kind })
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
        if (commit.isMerge && pi > 0) {
          kind = 'merge'
        } else if (lp < lc) {
          kind = 'converge'
        } else {
          kind = 'laneChange'
        }
      }

      if (kind === 'laneChange') continue

      pushEdge(i, lc, lp, kind)
      if (kind === 'merge') {
        pushEdge(i, lp, lp, 'straight')
      }
      for (let r = i + 1; r < rp; r++) pushEdge(r, lp, lp, 'straight')
    }
  }
}

function seedEdgeSeen(bands: GraphEdge[][]): Set<string>[] {
  return bands.map((band) => {
    const set = new Set<string>()
    for (const edge of band) {
      set.add(`${edge.fromLane}>${edge.toLane}`)
    }
    return set
  })
}

/**
 * Assigns commits to lanes (columns) and produces per-band edge segments for a
 * Multi-lane commit graph. Commits must be topologically sorted newest-first.
 */
export function computeGraphLayout(commits: Commit[]): GraphLayout {
  const n = commits.length
  if (n === 0) {
    return { nodes: [], bands: [], maxLanes: 1, laneState: { lanes: [] } }
  }

  const rowOf = new Map<string, number>()
  for (let i = 0; i < n; i++) rowOf.set(commits[i].sha, i)

  const laneOf = new Map<string, number>()
  const nodes: GraphNode[] = new Array(n)
  const ctx = createLaneContext()
  const maxLanes = assignNodes(commits, 0, ctx, nodes, laneOf)

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
): GraphLayout {
  if (newCommits.length === 0) return prevLayout

  const oldN = existingCommits.length
  if (
    !prevLayout.laneState ||
    prevLayout.nodes.length !== oldN ||
    prevLayout.bands.length !== oldN
  ) {
    return computeGraphLayout([...existingCommits, ...newCommits])
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
  const ctx = createLaneContext(prevLayout.laneState.lanes)
  const maxLanes = Math.max(
    prevLayout.maxLanes,
    assignNodes(commits, oldN, ctx, nodes, laneOf),
  )

  const bands = prevLayout.bands.map((band) => [...band])
  while (bands.length < n) bands.push([])
  const seen = seedEdgeSeen(bands)
  assignEdges(commits, nodes, laneOf, rowOf, bands, seen, oldN)

  return {
    nodes,
    bands,
    maxLanes,
    laneState: { lanes: [...ctx.lanes] },
  }
}
