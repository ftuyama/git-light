import { describe, expect, it } from 'vitest'
import { graphEdgePath } from './graphEdgePath'

describe('graphEdgePath', () => {
  it('draws a straight vertical line when lanes match', () => {
    expect(graphEdgePath(10, 5, 10, 35)).toBe('M10 5 L10 35')
  })

  it('draws a sharp merge rectangle into the branch column', () => {
    const d = graphEdgePath(10, 5, 30, 35, 5, 'merge')
    expect(d).toBe('M10 5 L10 6 L30 6 L30 35')
    expect(d).not.toContain('A')
  })

  it('anchors branch forks near the source row with sharp bends', () => {
    const d = graphEdgePath(10, 5, 30, 35, 5, 'laneChange')
    expect(d).toBe('M10 5 L10 15 L30 15 L30 35')
    expect(d).not.toContain('A')
  })

  it('anchors convergences near the target row with sharp bends', () => {
    const d = graphEdgePath(30, 5, 10, 35, 5, 'converge')
    expect(d).toBe('M30 5 L30 25 L10 25 L10 35')
    expect(d).not.toContain('A')
  })

  it('mirrors the merge rectangle when lanes are flipped left', () => {
    const d = graphEdgePath(30, 5, 10, 35, 5, 'merge')
    expect(d).toBe('M30 5 L30 6 L10 6 L10 35')
    expect(d).not.toContain('A')
  })
})
