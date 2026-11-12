import { describe, expect, it } from 'vitest'
import {
  githubAvatarUrl,
  githubAvatarUrlForUsername,
  gravatarUrl,
  isGithubAvatarUrl,
  isGravatarUrl,
} from './avatar'
import { githubUsernameFromEmail } from './avatar'

describe('githubUsernameFromEmail', () => {
  it('parses the modern noreply format with user id', () => {
    expect(githubUsernameFromEmail('105708372+felipetuyama@users.noreply.github.com')).toBe(
      'felipetuyama',
    )
  })

  it('parses the legacy noreply format', () => {
    expect(githubUsernameFromEmail('octocat@users.noreply.github.com')).toBe('octocat')
  })

  it('returns null for non-GitHub emails', () => {
    expect(githubUsernameFromEmail('user@example.com')).toBeNull()
  })
})

describe('githubAvatarUrl', () => {
  it('builds a GitHub profile image URL with size', () => {
    expect(githubAvatarUrl('octocat@users.noreply.github.com', 40)).toBe(
      'https://github.com/octocat.png?size=40',
    )
  })

  it('returns empty when the email has no GitHub username', () => {
    expect(githubAvatarUrl('user@example.com')).toBe('')
  })
})

describe('githubAvatarUrlForUsername', () => {
  it('builds a URL for a login from the GitHub API', () => {
    expect(githubAvatarUrlForUsername('torvalds', 18)).toBe(
      'https://github.com/torvalds.png?size=18',
    )
  })

  it('trims, encodes and clamps', () => {
    expect(githubAvatarUrlForUsername('  octo cat ', 1000)).toBe(
      'https://github.com/octo%20cat.png?size=460',
    )
    expect(githubAvatarUrlForUsername('   ', 40)).toBe('')
  })
})

describe('gravatarUrl', () => {
  it('hashes the normalized email', () => {
    expect(gravatarUrl(' MyEmailAddress@example.com ', 40)).toBe(
      'https://gravatar.com/avatar/0bc83cb571cd1c50ba6f3e8a78ef1346?d=404&r=pg&size=40',
    )
  })

  it('returns empty for a blank email', () => {
    expect(gravatarUrl('   ')).toBe('')
  })

  it('clamps the requested size', () => {
    expect(gravatarUrl('user@example.com', 0)).toContain('size=1')
    expect(gravatarUrl('user@example.com', 9999)).toContain('size=460')
  })
})

describe('avatar URL detection', () => {
  it('distinguishes GitHub, Gravatar and direct URLs', () => {
    expect(isGithubAvatarUrl('https://github.com/octocat.png?size=40')).toBe(true)
    expect(isGithubAvatarUrl(gravatarUrl('user@example.com'))).toBe(false)
    expect(isGravatarUrl(gravatarUrl('user@example.com'))).toBe(true)
    expect(isGravatarUrl('https://www.gravatar.com/avatar/abc?d=404')).toBe(true)
    expect(isGravatarUrl('https://cdn.example/avatar.png')).toBe(false)
  })
})
