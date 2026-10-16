import { describe, expect, it } from 'vitest'
import { graphEdgePath } from './graphEdgePath'

describe('graphEdgePath', () => {
  it('draws a straight vertical line when lanes match', () => {
    expect(graphEdgePath(10, 5, 10, 35)).toBe('M10 5 L10 35')
  })

  it('draws a smooth merge with a rounded corner near the source row', () => {
    const d = graphEdgePath(10, 5, 30, 35, 5, 'merge')
    expect(d).toBe('M10 5 L25 5 Q30 5 30 10 L30 35')
    expect(d).toContain('Q')
  })

  it('anchors branch forks with a rounded corner near the target row', () => {
    const d = graphEdgePath(10, 5, 30, 35, 5, 'laneChange')
    expect(d).toBe('M10 5 L10 30 Q10 35 15 35 L30 35')
    expect(d).toContain('Q')
  })

  it('anchors convergences with a rounded corner near the target row', () => {
    const d = graphEdgePath(30, 5, 10, 35, 5, 'converge')
    expect(d).toBe('M30 5 L30 30 Q30 35 25 35 L10 35')
    expect(d).toContain('Q')
  })

  it('mirrors the merge corner when lanes are flipped left', () => {
    const d = graphEdgePath(30, 5, 10, 35, 5, 'merge')
    expect(d).toBe('M30 5 L15 5 Q10 5 10 10 L10 35')
    expect(d).toContain('Q')
  })
})
