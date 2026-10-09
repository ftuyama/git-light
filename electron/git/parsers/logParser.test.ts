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

  it('hides the HEAD pseudo-ref but keeps isHead on the current branch', () => {
    const commits = parseCommits(commitRecord('HEAD -> ENG/bla, origin/ENG/bla'), authors)
    expect(commits[0]!.refs.some((ref) => ref.type === 'head')).toBe(false)
    expect(commits[0]!.refs).toContainEqual({
      type: 'localBranch',
      name: 'ENG/bla',
      label: 'ENG/bla',
      isHead: true,
    })
  })

  it('hides detached HEAD from the commit refs', () => {
    const commits = parseCommits(commitRecord('HEAD'), authors)
    expect(commits[0]!.refs).toEqual([])
  })

  it('hides symbolic origin/HEAD in full decorate output', () => {
    const commits = parseCommits(
      commitRecord('HEAD -> refs/heads/main, refs/remotes/origin/HEAD, refs/remotes/origin/main'),
      authors,
    )
    expect(commits[0]!.refs.some((ref) => ref.label === 'HEAD')).toBe(false)
    expect(commits[0]!.refs.map((ref) => ref.label).sort()).toEqual(['main', 'main'])
  })

  it('hides symbolic origin/HEAD in short decorate output', () => {
    const commits = parseCommits(commitRecord('HEAD -> main, origin/HEAD, origin/main'), authors)
    expect(commits[0]!.refs.some((ref) => ref.label === 'HEAD')).toBe(false)
    expect(commits[0]!.refs.map((ref) => ref.label).sort()).toEqual(['main', 'main'])
  })

  it('uses the configured log format marker', () => {
    expect(LOG_FORMAT.endsWith(RECORD)).toBe(true)
  })
})
