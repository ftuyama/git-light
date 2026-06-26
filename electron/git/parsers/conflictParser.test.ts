import { describe, expect, it } from 'vitest'
import { applyConflictResolution, parseConflictMarkers } from './conflictParser'

const SAMPLE = `line before
<<<<<<< HEAD
ours line 1
ours line 2
=======
theirs line 1
>>>>>>> feature/branch
line after`

describe('parseConflictMarkers', () => {
  it('parses a single conflict block', () => {
    const { blocks, hasMarkers } = parseConflictMarkers(SAMPLE)
    expect(hasMarkers).toBe(true)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      index: 0,
      oursLabel: 'HEAD',
      theirsLabel: 'feature/branch',
      ours: 'ours line 1\nours line 2',
      theirs: 'theirs line 1',
      startLine: 2,
      endLine: 7,
    })
  })

  it('parses zdiff3 base sections', () => {
    const zdiff3 = `<<<<<<< HEAD
ours
||||||| merged common ancestors
base
=======
theirs
>>>>>>> other`
    const { blocks } = parseConflictMarkers(zdiff3)
    expect(blocks[0].base).toBe('base')
    expect(blocks[0].ours).toBe('ours')
    expect(blocks[0].theirs).toBe('theirs')
  })

  it('returns empty when no markers exist', () => {
    const { blocks, hasMarkers } = parseConflictMarkers('clean file\nno conflicts')
    expect(hasMarkers).toBe(false)
    expect(blocks).toHaveLength(0)
  })
})

describe('applyConflictResolution', () => {
  it('replaces a block with ours', () => {
    const result = applyConflictResolution(SAMPLE, 0, 'ours')
    expect(result).toBe('line before\nours line 1\nours line 2\nline after')
  })

  it('replaces a block with theirs', () => {
    const result = applyConflictResolution(SAMPLE, 0, 'theirs')
    expect(result).toBe('line before\ntheirs line 1\nline after')
  })
})
