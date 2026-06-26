export type GraphEdgeKind = 'straight' | 'merge' | 'laneChange' | 'converge'

/**
 * Builds an SVG path for a graph edge between two row centers.
 * Merge edges use a rigid rectangle anchored just below the merge commit
 * (short vertical drop, horizontal at 90°, then down on the target branch).
 */
export function graphEdgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cornerRadius = 5,
  kind: GraphEdgeKind = 'laneChange',
): string {
  if (x1 === x2) {
    return `M${x1} ${y1} L${x2} ${y2}`
  }

  const dx = x2 - x1
  const dy = y2 - y1
  const absDx = Math.abs(dx)

  if (kind === 'merge') {
    const drop = Math.min(cornerRadius, absDx / 2, dy / 2 - 0.5)
    const yRail = y1 + Math.max((drop > 0 ? drop : 2) - 8, 1)
    return `M${x1} ${y1} L${x1} ${yRail} L${x2} ${yRail} L${x2} ${y2}`
  }

  if (kind === 'laneChange' && dx > 0) {
    const inset = Math.min(cornerRadius, absDx / 2, dy / 2 - 0.5)
    const yRail = inset > 0 ? y1 + 2 * inset : y1 + dy / 2
    return `M${x1} ${y1} L${x1} ${yRail} L${x2} ${yRail} L${x2} ${y2}`
  }

  if (kind === 'converge') {
    const inset = Math.min(cornerRadius, absDx / 2, dy / 2 - 0.5)
    const yRail = inset > 0 ? y2 - 2 * inset : y1 + dy / 2
    return `M${x1} ${y1} L${x1} ${yRail} L${x2} ${yRail} L${x2} ${y2}`
  }

  const y = y1 + dy / 2
  return `M${x1} ${y1} L${x1} ${y} L${x2} ${y} L${x2} ${y2}`
}
