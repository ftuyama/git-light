import { describe, expect, it } from 'vitest'
import { groupFileStatuses } from './fileStatus'
import type { FileStatus } from '@/types/git'

function filesOf(...statuses: FileStatus[]): { status: FileStatus }[] {
  return statuses.map((status) => ({ status }))
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
