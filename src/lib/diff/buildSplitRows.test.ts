import { describe, expect, it } from 'vitest'
import type { DiffHunk } from '@shared/git/models'
import { buildSplitRows } from './buildSplitRows'

function line(
  type: 'context' | 'add' | 'del',
  content: string,
  oldLine: number | null,
  newLine: number | null,
) {
  return { type, content, oldLine, newLine }
}

describe('buildSplitRows', () => {
  it('pairs context lines on both sides', () => {
    const hunks: DiffHunk[] = [
      {
        header: '@@ -1,2 +1,2 @@',
        oldStart: 1,
        oldLines: 2,
        newStart: 1,
        newLines: 2,
        lines: [line('context', 'unchanged', 1, 1)],
      },
    ]
    const rows = buildSplitRows(hunks)
    const data = rows.filter((r) => r.kind === 'line')
    expect(data).toHaveLength(1)
    if (data[0].kind === 'line') {
      expect(data[0].left.content).toBe('unchanged')
      expect(data[0].right.content).toBe('unchanged')
      expect(data[0].left.lineNum).toBe(1)
      expect(data[0].right.lineNum).toBe(1)
    }
  })

  it('pairs del/add blocks side by side', () => {
    const hunks: DiffHunk[] = [
      {
        header: '@@ -2,2 +2,2 @@',
        oldStart: 2,
        oldLines: 2,
        newStart: 2,
        newLines: 2,
        lines: [
          line('del', 'old line', 2, null),
          line('add', 'new line', null, 2),
        ],
      },
    ]
    const rows = buildSplitRows(hunks)
    const data = rows.filter((r) => r.kind === 'line')
    expect(data).toHaveLength(1)
    if (data[0].kind === 'line') {
      expect(data[0].left.type).toBe('del')
      expect(data[0].right.type).toBe('add')
      expect(data[0].left.content).toBe('old line')
      expect(data[0].right.content).toBe('new line')
    }
  })

  it('handles uneven del/add counts', () => {
    const hunks: DiffHunk[] = [
      {
        header: '@@ -1,3 +1,2 @@',
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 2,
        lines: [
          line('del', 'a', 1, null),
          line('del', 'b', 2, null),
          line('add', 'c', null, 1),
        ],
      },
    ]
    const rows = buildSplitRows(hunks)
    const data = rows.filter((r) => r.kind === 'line')
    expect(data).toHaveLength(2)
    if (data[0].kind === 'line' && data[1].kind === 'line') {
      expect(data[0].left.type).toBe('del')
      expect(data[0].right.type).toBe('add')
      expect(data[1].left.type).toBe('del')
      expect(data[1].right.type).toBe('empty')
    }
  })
})
