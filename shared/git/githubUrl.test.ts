import { describe, expect, it } from 'vitest'
import { githubCommitUrl, parseGithubRepoPath } from './githubUrl'

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
