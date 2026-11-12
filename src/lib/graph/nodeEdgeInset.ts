/**
 * Width of the ring painted around a graph node (`Avatar.vue` box-shadow).
 * The ring is opaque and sits on top of the edge layer.
 */
export const NODE_RING_WIDTH = 2

/** Visible radius of the marker used for merge commits, matching `Avatar.vue`. */
export function mergeMarkerRadius(nodeSize: number): number {
  return Math.max(6, Math.round(nodeSize * 0.5)) / 2
}

/**
 * Distance from a node center at which an incoming edge must stop.
 *
 * Edges are painted under the node overlay, and avatar images are transparent
 * at their circular edge, so a stroke that reaches the center shows through the
 * node as a sliver of the wrong lane color. Stopping one pixel inside the
 * opaque ring (or merge marker) hides the stroke end without leaving a gap.
 */
export function nodeEdgeEndInset(nodeSize: number, merge: boolean): number {
  const opaqueRadius = merge ? mergeMarkerRadius(nodeSize) : nodeSize / 2 + NODE_RING_WIDTH
  return Math.max(0, opaqueRadius - 1)
}
