import { describe, expect, it } from 'vitest'
import { mergeMarkerRadius, nodeEdgeEndInset, NODE_RING_WIDTH } from './nodeEdgeInset'

describe('nodeEdgeEndInset', () => {
  it('stops one pixel inside the avatar ring for regular nodes', () => {
    const nodeSize = 21
    expect(nodeEdgeEndInset(nodeSize, false)).toBe(nodeSize / 2 + NODE_RING_WIDTH - 1)
  })

  it('stops inside the merge marker, which is smaller than the avatar', () => {
    const nodeSize = 21
    expect(mergeMarkerRadius(nodeSize)).toBe(5.5)
    expect(nodeEdgeEndInset(nodeSize, true)).toBe(4.5)
  })

  it('keeps the merge marker at its minimum size on small zoom levels', () => {
    expect(mergeMarkerRadius(10)).toBe(3)
    expect(nodeEdgeEndInset(10, true)).toBe(2)
  })

  it('never returns a negative inset', () => {
    expect(nodeEdgeEndInset(0, true)).toBeGreaterThanOrEqual(0)
    expect(nodeEdgeEndInset(1, false)).toBeGreaterThanOrEqual(0)
  })
})
