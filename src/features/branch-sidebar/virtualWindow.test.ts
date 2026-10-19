import { describe, expect, it } from 'vitest'
import { visibleRows } from './virtualWindow'

const base = { viewportHeight: 400, rowHeight: 28, count: 1000, overscan: 12 }

describe('visibleRows', () => {
  it('covers the viewport when the list starts at the top', () => {
    expect(visibleRows({ ...base, scrollTop: 0, listTop: 0 })).toEqual({ start: 0, end: 27 })
  })

  it('follows the scroll position inside the list', () => {
    expect(visibleRows({ ...base, scrollTop: 1000, listTop: 0 })).toEqual({ start: 23, end: 62 })
  })

  it('accounts for a list sitting below the scroll origin', () => {
    expect(visibleRows({ ...base, scrollTop: 0, listTop: 100 })).toEqual({ start: 0, end: 23 })
  })

  it('renders nothing when the list is below the viewport', () => {
    expect(visibleRows({ ...base, scrollTop: 0, listTop: 5000 })).toEqual({ start: 0, end: 0 })
  })

  it('renders nothing when the list is above the viewport', () => {
    const above = visibleRows({ ...base, scrollTop: 5000, listTop: 0, count: 100 })
    expect(above).toEqual({ start: 100, end: 100 })
  })

  it('clamps the window to the row count', () => {
    expect(visibleRows({ ...base, scrollTop: 400, listTop: 0, count: 30 })).toEqual({
      start: 2,
      end: 30,
    })
  })

  it('handles empty lists and degenerate row heights', () => {
    expect(visibleRows({ ...base, scrollTop: 0, listTop: 0, count: 0 })).toEqual({
      start: 0,
      end: 0,
    })
    expect(visibleRows({ ...base, scrollTop: 0, listTop: 0, rowHeight: 0 })).toEqual({
      start: 0,
      end: 0,
    })
  })
})
