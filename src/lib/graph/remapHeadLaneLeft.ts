import type { GraphLayout } from './computeGraphLayout'
import { laneColor } from '@/lib/utils'

/** Moves the HEAD commit's lane to column 0, preserving other lanes' relative order. */
export function remapHeadLaneToLeft(
  layout: GraphLayout,
  headCommitIndex: number,
): GraphLayout {
  if (headCommitIndex < 0) return layout
  const headLane = layout.nodes[headCommitIndex]?.lane
  if (headLane === undefined || headLane === 0) return layout

  const laneOrder = [...new Set(layout.nodes.map((node) => node.lane))].sort((a, b) => a - b)
  const reordered = [headLane, ...laneOrder.filter((lane) => lane !== headLane)]
  const remapLane = new Map(reordered.map((lane, index) => [lane, index]))
  const mapLane = (lane: number): number => remapLane.get(lane) ?? lane

  return {
    maxLanes: layout.maxLanes,
    laneState: layout.laneState,
    nodes: layout.nodes.map((node) => ({
      ...node,
      lane: mapLane(node.lane),
      color: laneColor(mapLane(node.lane)),
    })),
    bands: layout.bands.map((band) =>
      band.map((edge) => ({
        ...edge,
        fromLane: mapLane(edge.fromLane),
        toLane: mapLane(edge.toLane),
        color: laneColor(mapLane(edge.toLane)),
      })),
    ),
  }
}
