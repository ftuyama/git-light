/** Pure pan/zoom math for the image lightbox. Kept UI-free so it is unit-testable. */

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 8
const ZOOM_STEP = 1.25

export interface ZoomTransform {
  scale: number
  tx: number
  ty: number
}

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) return 1
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale))
}

/** Multiplies the zoom by one step (in) or its inverse (out), clamped. */
export function zoomStep(scale: number, direction: 'in' | 'out'): number {
  const factor = direction === 'in' ? ZOOM_STEP : 1 / ZOOM_STEP
  return clampZoom(scale * factor)
}

/**
 * Zoom keeping the point under the cursor anchored: the content point at
 * (`cursorX`, `cursorY`) stays under the cursor after scaling.
 * Coordinates are in the viewport's local (client-offset) space.
 */
export function zoomAtPoint(
  transform: ZoomTransform,
  cursorX: number,
  cursorY: number,
  factor: number,
): ZoomTransform {
  const scale = clampZoom(transform.scale * factor)
  if (scale === transform.scale) return transform
  const ratio = scale / transform.scale
  return {
    scale,
    tx: cursorX - (cursorX - transform.tx) * ratio,
    ty: cursorY - (cursorY - transform.ty) * ratio,
  }
}

export function resetTransform(): ZoomTransform {
  return { scale: 1, tx: 0, ty: 0 }
}
