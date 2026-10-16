import { describe, expect, it } from 'vitest'
import { commitMatchesFilter, isGraphFiltering, stashMatchesFilter } from './graphFilter'
import type { Commit, Stash } from '@/types/git'

function makeCommit(overrides: Partial<Commit> = {}): Commit {
  return {
    sha: 'abc123def456',
    shortSha: 'abc123d',
    parents: [],
    subject: 'Add checkout flow',
    author: { name: 'Ada Lovelace', email: 'ada@example.com', avatarUrl: '', initials: 'AL', color: '#fff' },
    committer: { name: 'Ada Lovelace', email: 'ada@example.com', avatarUrl: '', initials: 'AL', color: '#fff' },
    date: new Date(0),
    refs: [],
    isMerge: false,
    ...overrides,
  }
}

function makeStash(overrides: Partial<Stash> = {}): Stash {
  return {
    id: 'stash@{0}',
    index: 0,
    message: 'WIP on main: checkout work',
    branch: 'main',
    date: new Date(0),
    filesChanged: 2,
    baseSha: 'abc123def456',
    baseSubject: 'Add checkout flow',
    ...overrides,
  }
}

describe('graphFilter', () => {
  it('treats blank queries as no filtering', () => {
    expect(isGraphFiltering('')).toBe(false)
    expect(isGraphFiltering('   ')).toBe(false)
    expect(isGraphFiltering('x')).toBe(true)
    expect(commitMatchesFilter(makeCommit(), '')).toBe(true)
    expect(stashMatchesFilter(makeStash(), '  ')).toBe(true)
  })

  it('matches commits by subject, sha, author, and refs case-insensitively', () => {
    const commit = makeCommit({
      refs: [{ type: 'localBranch', name: 'refs/heads/feature/pay', label: 'feature/pay' }],
    })
    expect(commitMatchesFilter(commit, 'CHECKOUT')).toBe(true)
    expect(commitMatchesFilter(commit, 'abc123')).toBe(true)
    expect(commitMatchesFilter(commit, 'ada')).toBe(true)
    expect(commitMatchesFilter(commit, 'feature/pay')).toBe(true)
    expect(commitMatchesFilter(commit, 'nope')).toBe(false)
  })

  it('matches stashes by branch, message, id, and base', () => {
    const stash = makeStash()
    expect(stashMatchesFilter(stash, 'main')).toBe(true)
    expect(stashMatchesFilter(stash, 'checkout')).toBe(true)
    expect(stashMatchesFilter(stash, 'stash@{0}')).toBe(true)
    expect(stashMatchesFilter(stash, 'abc123')).toBe(true)
    expect(stashMatchesFilter(stash, 'other-branch')).toBe(false)
  })
})
