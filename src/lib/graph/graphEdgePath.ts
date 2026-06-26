/**
 * Builds an SVG path for a graph edge between two row centers.
 * Lane changes use orthogonal segments with softened (quadratic) corners,
 * matching GitKraken's rounded-rectangle merge look.
 */
export function graphEdgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cornerRadius = 5,
): string {
  if (x1 === x2) {
    return `M${x1} ${y1} L${x2} ${y2}`
  }

  const mid = (y1 + y2) / 2
  const dx = x2 - x1
  const r = Math.min(cornerRadius, Math.abs(dx) / 2, (y2 - y1) / 2 - 0.5)

  if (r <= 0) {
    return `M${x1} ${y1} L${x1} ${mid} L${x2} ${mid} L${x2} ${y2}`
  }

  const dir = dx > 0 ? 1 : -1
  return [
    `M${x1} ${y1}`,
    `L${x1} ${mid - r}`,
    `Q${x1} ${mid} ${x1 + dir * r} ${mid}`,
    `L${x2 - dir * r} ${mid}`,
    `Q${x2} ${mid} ${x2} ${mid + r}`,
    `L${x2} ${y2}`,
  ].join(' ')
}
