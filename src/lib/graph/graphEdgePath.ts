export type GraphEdgeKind = 'straight' | 'merge' | 'laneChange' | 'converge'

/**
 * Builds an SVG path for a graph edge between two row centers.
 * GitKraken-style single rounded corner (matches prefetch canvas `arcTo`):
 * - merge: horizontal off the merge commit, then a rounded corner down
 *   into the merge-parent lane (corner near the source row).
 * - converge / laneChange: vertical down the source lane, then a rounded
 *   corner into the target lane (corner near the target row).
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
  const absDy = Math.abs(dy)
  const r = Math.min(cornerRadius, absDx, absDy)
  if (!(r > 0)) {
    return `M${x1} ${y1} L${x2} ${y2}`
  }

  const sx = Math.sign(dx)
  const sy = dy === 0 ? 1 : Math.sign(dy)

  if (kind === 'merge') {
    const xH = x2 - sx * r
    const yV = y1 + sy * r
    return `M${x1} ${y1} L${xH} ${y1} Q${x2} ${y1} ${x2} ${yV} L${x2} ${y2}`
  }

  const yV = y2 - sy * r
  const xH = x1 + sx * r
  return `M${x1} ${y1} L${x1} ${yV} Q${x1} ${y2} ${xH} ${y2} L${x2} ${y2}`
}
