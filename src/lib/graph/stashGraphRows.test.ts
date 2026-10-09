import { describe, expect, it } from 'vitest'
import {
  buildGraphRows,
  commitVirtualIndexByCommit,
  stashVirtualIndexByStash,
} from './stashGraphRows'

const commits = [{ sha: 'c' }, { sha: 'b' }, { sha: 'a' }]

describe('buildGraphRows', () => {
  it('matches legacy pending-only ordering', () => {
    expect(buildGraphRows(commits, true, [])).toEqual([
      { kind: 'pending' },
      { kind: 'commit', commitIndex: 0 },
      { kind: 'commit', commitIndex: 1 },
      { kind: 'commit', commitIndex: 2 },
    ])
    expect(buildGraphRows(commits, false, [])).toEqual([
      { kind: 'commit', commitIndex: 0 },
      { kind: 'commit', commitIndex: 1 },
      { kind: 'commit', commitIndex: 2 },
    ])
  })

  it('inserts a stash immediately above its base commit', () => {
    const rows = buildGraphRows(commits, true, [{ baseSha: 'a' }])
    expect(rows).toEqual([
      { kind: 'pending' },
      { kind: 'commit', commitIndex: 0 },
      { kind: 'commit', commitIndex: 1 },
      { kind: 'stash', stashIndex: 0 },
      { kind: 'commit', commitIndex: 2 },
    ])
    const byCommit = commitVirtualIndexByCommit(rows)
    expect(byCommit.get(2)).toBe(4)
    expect(stashVirtualIndexByStash(rows).get(0)).toBe(3)
  })

  it('falls back to the top when the base commit is not loaded', () => {
    expect(buildGraphRows(commits, true, [{ baseSha: 'missing' }])).toEqual([
      { kind: 'pending' },
      { kind: 'stash', stashIndex: 0 },
      { kind: 'commit', commitIndex: 0 },
      { kind: 'commit', commitIndex: 1 },
      { kind: 'commit', commitIndex: 2 },
    ])
    expect(buildGraphRows(commits, false, [{ baseSha: null }])[0]).toEqual({
      kind: 'stash',
      stashIndex: 0,
    })
  })

  it('keeps stash index order for stashes sharing a base', () => {
    const rows = buildGraphRows(commits, false, [
      { baseSha: 'b' },
      { baseSha: 'b' },
    ])
    expect(rows).toEqual([
      { kind: 'commit', commitIndex: 0 },
      { kind: 'stash', stashIndex: 0 },
      { kind: 'stash', stashIndex: 1 },
      { kind: 'commit', commitIndex: 1 },
      { kind: 'commit', commitIndex: 2 },
    ])
  })
})
