import { describe, expect, it } from 'vitest'
import { githubBranchUrl, githubCommitUrl, parseGithubRepoPath } from './githubUrl'

describe('parseGithubRepoPath', () => {
  it('parses HTTPS remotes', () => {
    expect(parseGithubRepoPath('https://github.com/acme/widgets.git')).toEqual({
      owner: 'acme',
      repo: 'widgets',
    })
  })

  it('parses SSH remotes', () => {
    expect(parseGithubRepoPath('git@github.com:acme/widgets.git')).toEqual({
      owner: 'acme',
      repo: 'widgets',
    })
  })

  it('returns null for non-GitHub hosts', () => {
    expect(parseGithubRepoPath('git@gitlab.com:acme/widgets.git')).toBeNull()
  })
})

describe('githubCommitUrl', () => {
  it('builds a commit URL from a remote', () => {
    expect(githubCommitUrl('git@github.com:acme/widgets.git', 'abc123')).toBe(
      'https://github.com/acme/widgets/commit/abc123',
    )
  })
})

describe('githubBranchUrl', () => {
  it('builds a branch URL and preserves slashes', () => {
    expect(githubBranchUrl('git@github.com:acme/widgets.git', 'feature/login')).toBe(
      'https://github.com/acme/widgets/tree/feature/login',
    )
  })

  it('encodes branch name segments', () => {
    expect(githubBranchUrl('https://github.com/acme/widgets', 'fix/a b')).toBe(
      'https://github.com/acme/widgets/tree/fix/a%20b',
    )
  })

  it('returns null for non-GitHub remotes and empty names', () => {
    expect(githubBranchUrl('git@gitlab.com:acme/widgets.git', 'main')).toBeNull()
    expect(githubBranchUrl('git@github.com:acme/widgets.git', '')).toBeNull()
  })
})
