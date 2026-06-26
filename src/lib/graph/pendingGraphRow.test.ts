import { describe, expect, it } from 'vitest'
import {
  commitIndexForVirtual,
  headCommitIndex,
  PENDING_ROW_VIRTUAL_INDEX,
  virtualIndexForCommit,
  virtualRowCount,
} from './pendingGraphRow'

const commits = [
  { sha: 'c', refs: [{ isHead: true }] },
  { sha: 'b', refs: [] },
  { sha: 'a', refs: [] },
]

describe('pendingGraphRow', () => {
  it('finds HEAD by sha or ref', () => {
    expect(headCommitIndex(commits, 'c')).toBe(0)
    expect(headCommitIndex(commits)).toBe(0)
    expect(headCommitIndex(commits, 'missing')).toBe(0)
  })

  it('keeps the pending row at the top of history', () => {
    expect(virtualRowCount(3, true)).toBe(4)
    expect(PENDING_ROW_VIRTUAL_INDEX).toBe(0)
    expect(commitIndexForVirtual(0, true)).toBeNull()
    expect(commitIndexForVirtual(1, true)).toBe(0)
    expect(commitIndexForVirtual(3, true)).toBe(2)
    expect(virtualIndexForCommit(0, true)).toBe(1)
    expect(virtualIndexForCommit(2, true)).toBe(3)
  })

  it('is a no-op when there is no pending row', () => {
    expect(commitIndexForVirtual(2, false)).toBe(2)
    expect(virtualIndexForCommit(2, false)).toBe(2)
  })
})
