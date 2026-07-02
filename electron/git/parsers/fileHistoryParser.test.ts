import { describe, expect, it } from 'vitest'
import { parseFileHistory } from './fileHistoryParser'

describe('parseFileHistory', () => {
  it('parses delimited log output', () => {
    const stdout = [
      'abc1234567890abcdef1234567890abcdef1234\x1fInitial commit\x1fAlice\x1f1700000000',
      'def1234567890abcdef1234567890abcdef1234\x1fUpdate file\x1fBob\x1f1700000100',
    ].join('\n')

    const entries = parseFileHistory(stdout)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      sha: 'abc1234567890abcdef1234567890abcdef1234',
      shortSha: 'abc1234',
      subject: 'Initial commit',
      author: 'Alice',
    })
    expect(entries[1]?.author).toBe('Bob')
  })

  it('returns empty array for blank output', () => {
    expect(parseFileHistory('')).toEqual([])
  })
})
