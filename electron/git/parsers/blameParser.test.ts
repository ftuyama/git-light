import { describe, expect, it } from 'vitest'
import { parseBlamePorcelain } from './blameParser'

describe('parseBlamePorcelain', () => {
  it('parses line-porcelain blame output', () => {
    const stdout = [
      'abc1234567890abcdef1234567890abcdef1234 1 1 2',
      'author Alice',
      'author-mail <alice@example.com>',
      'author-time 1700000000',
      'author-tz +0000',
      'committer Alice',
      'committer-mail <alice@example.com>',
      'committer-time 1700000000',
      'committer-tz +0000',
      'summary Initial commit',
      'filename README.md',
      '\tHello',
      'def1234567890abcdef1234567890abcdef1234 2 2',
      'author Bob',
      'author-mail <bob@example.com>',
      'author-time 1700000100',
      'author-tz +0000',
      'committer Bob',
      'committer-mail <bob@example.com>',
      'committer-time 1700000100',
      'committer-tz +0000',
      'summary Add world',
      'filename README.md',
      '\tWorld',
    ].join('\n')

    const lines = parseBlamePorcelain(stdout)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({
      lineNumber: 1,
      commitSha: 'abc1234567890abcdef1234567890abcdef1234',
      shortSha: 'abc1234',
      author: 'Alice',
      authorEmail: '<alice@example.com>',
      authorTime: 1700000000,
      summary: 'Initial commit',
      content: 'Hello',
    })
    expect(lines[1]?.content).toBe('World')
    expect(lines[1]?.author).toBe('Bob')
  })
})
