import { describe, expect, it } from 'vitest'
import { parseRebaseCommits } from './rebaseCommitsParser'

describe('parseRebaseCommits', () => {
  it('parses reverse log records', () => {
    const stdout =
      'aaa1111111111111111111111111111111111111111\x1faaa1111\x1fFirst\x1fAlice\x1f1700000000\x1e' +
      'bbb2222222222222222222222222222222222222222\x1fbbb2222\x1fSecond\x1fBob\x1f1700000100\x1e'

    const commits = parseRebaseCommits(stdout)
    expect(commits).toHaveLength(2)
    expect(commits[0]).toMatchObject({
      sha: 'aaa1111111111111111111111111111111111111111',
      shortSha: 'aaa1111',
      subject: 'First',
      authorName: 'Alice',
    })
    expect(commits[1]?.subject).toBe('Second')
  })

  it('returns empty array for blank output', () => {
    expect(parseRebaseCommits('')).toEqual([])
  })
})
