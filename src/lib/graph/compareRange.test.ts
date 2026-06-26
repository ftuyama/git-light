import { describe, expect, it } from 'vitest'
import { normalizeCompareRange } from '@/lib/graph/compareRange'
import type { Commit } from '@/types/git'

function commit(sha: string, index: number): Commit {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    parents: [],
    subject: `commit ${index}`,
    author: {
      name: 'A',
      email: 'a@example.com',
      avatarUrl: '',
      initials: 'A',
      color: '#fff',
    },
    committer: {
      name: 'A',
      email: 'a@example.com',
      avatarUrl: '',
      initials: 'A',
      color: '#fff',
    },
    date: new Date(),
    refs: [],
    isMerge: false,
  }
}

describe('normalizeCompareRange', () => {
  const commits = [commit('newest', 0), commit('middle', 1), commit('oldest', 2)]

  it('orders older commit as fromSha when graph is newest-first', () => {
    const range = normalizeCompareRange('newest', 'oldest', commits)
    expect(range.fromSha).toBe('oldest')
    expect(range.toSha).toBe('newest')
  })

  it('orders correctly regardless of click order', () => {
    const range = normalizeCompareRange('oldest', 'newest', commits)
    expect(range.fromSha).toBe('oldest')
    expect(range.toSha).toBe('newest')
  })
})
