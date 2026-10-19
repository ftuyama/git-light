/**
 * Row windowing for the branch sidebar.
 *
 * The sidebar stacks every section inside one shared scroller, so a section
 * cannot own the scroll position; it only knows where its own list starts. The
 * window is therefore derived from the scroller's offset plus the list's top
 * edge, both in the scroller's content coordinates.
 *
 * Rows in a windowed section all render at the same fixed height (every row is
 * `h-7`), which is what makes a plain division exact instead of an estimate.
 */
export interface VirtualWindowInput {
  /** Scroll offset of the shared scroller, in content pixels. */
  scrollTop: number
  /** Height of the scroller's viewport, in pixels. */
  viewportHeight: number
  /** Offset of the list's top edge inside the scroller's content. */
  listTop: number
  /** Height of a single row, in pixels. */
  rowHeight: number
  /** Total number of rows in the list. */
  count: number
  /** Extra rows rendered above and below the viewport. */
  overscan?: number
}

export interface VirtualWindow {
  /** First rendered row (inclusive). */
  start: number
  /** Last rendered row (exclusive). */
  end: number
}

/**
 * Index range of `count` fixed-height rows that covers the scroller's viewport.
 * Returns an empty range when the list sits entirely outside it, so a long
 * section scrolled out of view renders no rows at all.
 */
export function visibleRows({
  scrollTop,
  viewportHeight,
  listTop,
  rowHeight,
  count,
  overscan = 12,
}: VirtualWindowInput): VirtualWindow {
  if (count <= 0 || rowHeight <= 0) return { start: 0, end: 0 }

  const first = Math.floor((scrollTop - listTop) / rowHeight) - overscan
  const last = Math.ceil((scrollTop + viewportHeight - listTop) / rowHeight) + overscan
  const start = Math.max(0, Math.min(count, first))
  const end = Math.max(start, Math.min(count, last))
  return { start, end }
}
