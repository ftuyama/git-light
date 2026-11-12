import { describe, expect, it } from 'vitest'
import { groupFileStatuses, sortFilesForDisplay } from './fileStatus'
import type { FileStatus, WorkingTreeFile } from '@/types/git'

function filesOf(...statuses: FileStatus[]): { status: FileStatus }[] {
  return statuses.map((status) => ({ status }))
}

function file(path: string, status: FileStatus): WorkingTreeFile {
  return {
    id: `file:${path}`,
    path,
    fileName: path.split('/').pop() ?? path,
    directory: '',
    status,
    staged: false,
    additions: 0,
    deletions: 0,
  }
}

describe('groupFileStatuses', () => {
  it('returns an empty list when there are no files', () => {
    expect(groupFileStatuses([])).toEqual([])
  })

  it('counts untracked files as added', () => {
    expect(groupFileStatuses(filesOf('added', 'untracked'))).toEqual([
      { status: 'added', count: 2 },
    ])
  })

  it('groups by display order and skips empty statuses', () => {
    expect(
      groupFileStatuses(
        filesOf('deleted', 'modified', 'renamed', 'modified', 'copied', 'conflicted'),
      ),
    ).toEqual([
      { status: 'modified', count: 2 },
      { status: 'deleted', count: 1 },
      { status: 'renamed', count: 1 },
      { status: 'copied', count: 1 },
      { status: 'conflicted', count: 1 },
    ])
  })
})

describe('sortFilesForDisplay', () => {
  it('orders by status, then by path', () => {
    const sorted = sortFilesForDisplay([
      file('src/z.ts', 'deleted'),
      file('src/b.ts', 'modified'),
      file('src/a.ts', 'modified'),
      file('docs/new.md', 'added'),
    ])
    expect(sorted.map((f) => f.path)).toEqual([
      'src/a.ts',
      'src/b.ts',
      'docs/new.md',
      'src/z.ts',
    ])
  })

  it('keeps the input untouched', () => {
    const input = [file('b.ts', 'modified'), file('a.ts', 'modified')]
    sortFilesForDisplay(input)
    expect(input.map((f) => f.path)).toEqual(['b.ts', 'a.ts'])
  })
})
