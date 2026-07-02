import { describe, expect, it } from 'vitest'
import type { DiffHunk } from '@shared/git/models'
import { buildPatchFromHunk, buildPatchFromHunkLines } from './buildPatch'

const sampleHunk: DiffHunk = {
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

describe('buildPatchFromHunk', () => {
  it('emits a valid unified diff header and body', () => {
    const patch = buildPatchFromHunk('src/foo.ts', sampleHunk)
    expect(patch).toContain('diff --git a/src/foo.ts b/src/foo.ts')
    expect(patch).toContain('--- a/src/foo.ts')
    expect(patch).toContain('+++ b/src/foo.ts')
    expect(patch).toContain('@@ -1,4 +1,5 @@')
    expect(patch).toContain('-old line')
    expect(patch).toContain('+new line')
  })

  it('uses oldPath for renames', () => {
    const patch = buildPatchFromHunk('src/new.ts', sampleHunk, 'src/old.ts')
    expect(patch).toContain('diff --git a/src/old.ts b/src/new.ts')
    expect(patch).toContain('--- a/src/old.ts')
    expect(patch).toContain('+++ b/src/new.ts')
  })
})

describe('buildPatchFromHunkLines', () => {
  it('includes only selected change lines', () => {
    const patch = buildPatchFromHunkLines('file.txt', sampleHunk, [4])
    expect(patch).toContain('+extra')
    expect(patch).not.toContain('-old line')
    expect(patch).not.toContain('+new line')
    expect(patch).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/)
  })

  it('groups multiple selected lines in one hunk', () => {
    const patch = buildPatchFromHunkLines('file.txt', sampleHunk, [1, 2])
    expect(patch).toContain('-old line')
    expect(patch).toContain('+new line')
    expect(patch).not.toContain('+extra')
  })

  it('includes leading context for mid-file replacement', () => {
    const patch = buildPatchFromHunkLines('file.txt', sampleHunk, [1, 2])
    expect(patch).toContain(' line1')
    expect(patch).toContain('@@ -1,3 +1,3 @@')
  })

  it('includes leading context for mid-file insertion', () => {
    const patch = buildPatchFromHunkLines('file.txt', sampleHunk, [4])
    expect(patch).toContain(' line3')
    expect(patch).toContain('@@ -3,1 +3,2 @@')
  })

  it('anchors add-only selection with preceding context', () => {
    const midFileHunk: DiffHunk = {
      header: '@@ -10,3 +10,4 @@',
      oldStart: 10,
      oldLines: 3,
      newStart: 10,
      newLines: 4,
      lines: [
        { type: 'context', content: 'before', oldLine: 10, newLine: 10 },
        { type: 'context', content: 'anchor', oldLine: 11, newLine: 11 },
        { type: 'add', content: 'inserted', oldLine: null, newLine: 12 },
        { type: 'context', content: 'after', oldLine: 12, newLine: 13 },
      ],
    }
    const patch = buildPatchFromHunkLines('file.txt', midFileHunk, [2])
    expect(patch).toContain(' anchor')
    expect(patch).toContain('+inserted')
    expect(patch).toContain('@@ -10,3 +10,4 @@')
  })
})
