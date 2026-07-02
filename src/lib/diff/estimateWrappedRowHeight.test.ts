import { describe, expect, it } from 'vitest'
import {
  DIFF_ROW_HEIGHT,
  estimateWrappedLineCount,
  estimateWrappedRowHeight,
} from './estimateWrappedRowHeight'

describe('estimateWrappedRowHeight', () => {
  it('returns one row height for short content', () => {
    expect(estimateWrappedRowHeight('short', 300)).toBe(DIFF_ROW_HEIGHT)
  })

  it('estimates multiple rows for long content', () => {
    const content = 'a'.repeat(120)
    const lines = estimateWrappedLineCount(content, 60)
    expect(lines).toBeGreaterThan(1)
    expect(estimateWrappedRowHeight(content, 60)).toBe(lines * DIFF_ROW_HEIGHT)
  })

  it('counts explicit newlines', () => {
    expect(estimateWrappedLineCount('one\ntwo\nthree', 300)).toBe(3)
  })

  it('returns at least one line for zero width', () => {
    expect(estimateWrappedLineCount('hello', 0)).toBe(1)
  })
})
