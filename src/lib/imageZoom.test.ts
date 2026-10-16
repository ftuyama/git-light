import { describe, expect, it } from 'vitest'
import { clampZoom, resetTransform, zoomAtPoint, zoomStep, MAX_ZOOM, MIN_ZOOM } from './imageZoom'

describe('clampZoom', () => {
  it('clamps to the allowed range and falls back for non-finite input', () => {
    expect(clampZoom(1)).toBe(1)
    expect(clampZoom(100)).toBe(MAX_ZOOM)
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(NaN)).toBe(1)
  })
})

describe('zoomStep', () => {
  it('steps in and out symmetrically', () => {
    const zoomed = zoomStep(1, 'in')
    expect(zoomed).toBeGreaterThan(1)
    expect(zoomStep(zoomed, 'out')).toBeCloseTo(1, 10)
  })

  it('never leaves the allowed range', () => {
    expect(zoomStep(MAX_ZOOM, 'in')).toBe(MAX_ZOOM)
    expect(zoomStep(MIN_ZOOM, 'out')).toBe(MIN_ZOOM)
  })
})

describe('zoomAtPoint', () => {
  it('keeps the cursor-anchored point fixed', () => {
    const t = { scale: 1, tx: 10, ty: 20 }
    const next = zoomAtPoint(t, 100, 80, 2)
    expect(next.scale).toBe(2)
    // content point under cursor before: (100 - 10) / 1 = 90; after: (100 - tx') / 2 = 90
    expect((100 - next.tx) / next.scale).toBeCloseTo(90, 10)
    expect((80 - next.ty) / next.scale).toBeCloseTo(60, 10)
  })

  it('returns the same transform when already clamped at the bound', () => {
    const t = { scale: MAX_ZOOM, tx: 0, ty: 0 }
    expect(zoomAtPoint(t, 50, 50, 2)).toBe(t)
  })
})

describe('resetTransform', () => {
  it('returns identity', () => {
    expect(resetTransform()).toEqual({ scale: 1, tx: 0, ty: 0 })
  })
})
