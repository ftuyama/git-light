import { describe, expect, it } from 'vitest'
import { githubAvatarUrl, githubUsernameFromEmail } from './avatar'

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
