import { describe, expect, it } from 'vitest'
import type { DiffHunk } from '@shared/git/models'
import { collectSplitLineIndices, pairedLineIndices } from './pairedLineIndices'

const hunk: DiffHunk = {
  header: '@@ -1,4 +1,5 @@',
  oldStart: 1,
  oldLines: 4,
  newStart: 1,
  newLines: 5,
  lines: [
    { type: 'context', content: 'line1', oldLine: 1, newLine: 1 },
    { type: 'del', content: 'old line', oldLine: 2, newLine: null },
    { type: 'add', content: 'new line', oldLine: null, newLine: 2 },
    { type: 'context', content: 'line3', oldLine: 3, newLine: 3 },
    { type: 'add', content: 'extra', oldLine: null, newLine: 4 },
  ],
}

describe('pairedLineIndices', () => {
  it('pairs del with following add', () => {
    expect(pairedLineIndices(hunk, 1)).toEqual([1, 2])
  })

  it('pairs add with preceding del', () => {
    expect(pairedLineIndices(hunk, 2)).toEqual([1, 2])
  })

  it('returns single index for pure insertion', () => {
    expect(pairedLineIndices(hunk, 4)).toEqual([4])
  })

  it('returns single index for context lines', () => {
    expect(pairedLineIndices(hunk, 0)).toEqual([0])
  })
})

describe('collectSplitLineIndices', () => {
  it('collects both indices when different', () => {
    expect(collectSplitLineIndices(1, 2)).toEqual([1, 2])
  })

  it('deduplicates when same index', () => {
    expect(collectSplitLineIndices(3, 3)).toEqual([3])
  })

  it('handles single side', () => {
    expect(collectSplitLineIndices(undefined, 4)).toEqual([4])
  })
})
