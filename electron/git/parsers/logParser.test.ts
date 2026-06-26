import { describe, expect, it } from 'vitest'
import { LOG_FORMAT, parseCommits } from './logParser'
import { AuthorRegistry } from './authors'

const FIELD = '\x1f'
const RECORD = '\x1e'

function commitRecord(decorations: string): string {
  return [
    'abc1234567890abcdef1234567890abcdef1234567',
    '',
    'Author',
    'author@example.com',
    'Author',
    'author@example.com',
    '1700000000',
    decorations,
    'subject',
    '',
  ].join(FIELD) + RECORD
}

describe('parseCommits decorations', () => {
  const authors = new AuthorRegistry()

  it('preserves full folder-style branch names for local and remote refs', () => {
    const commits = parseCommits(
      commitRecord('HEAD -> refs/heads/ENG/bla, refs/remotes/origin/ENG/bla'),
      authors,
    )
    const labels = commits[0]!.refs
      .filter((ref) => ref.type !== 'head')
      .map((ref) => ref.label)
    expect(labels).toEqual(['ENG/bla', 'ENG/bla'])
  })

  it('classifies refs/heads/ as local even when the branch name contains slashes', () => {
    const commits = parseCommits(commitRecord('refs/heads/ENG/bla'), authors)
    expect(commits[0]!.refs).toEqual([
      {
        type: 'localBranch',
        name: 'refs/heads/ENG/bla',
        label: 'ENG/bla',
      },
    ])
  })

  it('parses short decorate output for folder-style branch names', () => {
    const commits = parseCommits(commitRecord('HEAD -> ENG/bla, origin/ENG/bla'), authors)
    const labels = commits[0]!.refs
      .filter((ref) => ref.type !== 'head')
      .map((ref) => ref.label)
    expect(labels).toEqual(['ENG/bla', 'ENG/bla'])
  })

  it('uses the configured log format marker', () => {
    expect(LOG_FORMAT.endsWith(RECORD)).toBe(true)
  })
})
