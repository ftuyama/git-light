import { describe, expect, it } from 'vitest'
import { graphEdgePath } from './graphEdgePath'

describe('graphEdgePath', () => {
  it('draws a straight vertical line when lanes match', () => {
    expect(graphEdgePath(10, 5, 10, 35)).toBe('M10 5 L10 35')
  })

  it('uses orthogonal segments with rounded corners for lane changes', () => {
    const d = graphEdgePath(10, 5, 30, 35, 5)
    expect(d).toContain('M10 5')
    expect(d).toContain('L10 15')
    expect(d).toContain('Q10 20 15 20')
    expect(d).toContain('L25 20')
    expect(d).toContain('Q30 20 30 25')
    expect(d).toContain('L30 35')
    expect(d).not.toContain('C ')
  })

  it('mirrors corners when moving left', () => {
    const d = graphEdgePath(30, 5, 10, 35, 5)
    expect(d).toContain('Q30 20 25 20')
    expect(d).toContain('L15 20')
    expect(d).toContain('Q10 20 10 25')
  })

  it('clamps corner radius for tight bands', () => {
    const d = graphEdgePath(10, 0, 30, 4, 5)
    expect(d).toContain('Q10 2')
    expect(d).toContain('Q30 2')
    expect(d).not.toContain('C ')
  })
})
