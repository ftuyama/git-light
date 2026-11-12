import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { githubAvatarUrlForUsername, githubAvatarUrl, gravatarUrl } from '@shared/git/avatar'
import {
  avatarCacheVersion,
  clearAvatarCache,
  clearAvatarCacheForTests,
  markAvatarSourceMissing,
  markGithubAvatarLogins,
  resetAvatarSessionForTests,
  resolveAuthorAvatarUrl,
  setRemoteAvatarsEnabled,
} from './avatarCache'

const GITHUB_EMAIL = 'octocat@users.noreply.github.com'
const OTHER_EMAIL = 'user@example.com'

function mockLocalStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear() {
      data.clear()
    },
    getItem(key: string) {
      return data.get(key) ?? null
    },
    key(index: number) {
      return [...data.keys()][index] ?? null
    },
    removeItem(key: string) {
      data.delete(key)
    },
    setItem(key: string, value: string) {
      data.set(key, value)
    },
  }
}

beforeEach(() => {
  clearAvatarCacheForTests()
  globalThis.localStorage = mockLocalStorage()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('resolveAuthorAvatarUrl', () => {
  it('returns a GitHub avatar URL for noreply emails', () => {
    expect(resolveAuthorAvatarUrl(GITHUB_EMAIL, '', 40)).toBe(githubAvatarUrl(GITHUB_EMAIL, 40))
  })

  it('falls back to Gravatar for regular emails', () => {
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, '', 40)).toBe(gravatarUrl(OTHER_EMAIL, 40))
  })

  it('returns null for an empty email', () => {
    expect(resolveAuthorAvatarUrl('   ', '', 40)).toBeNull()
  })

  it('uses non-GitHub URLs directly', () => {
    const direct = 'https://cdn.example/avatar.png'
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, direct, 40)).toBe(direct)
  })

  it('prefers a cached GitHub login from the commits API', () => {
    markGithubAvatarLogins({ 'user@example.com': 'torvalds' })
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, '', 36)).toBe(
      githubAvatarUrlForUsername('torvalds', 36),
    )
  })

  it('sizes each source for the current display size', () => {
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, '', 18)).toContain('size=18')
    expect(resolveAuthorAvatarUrl(GITHUB_EMAIL, '', 18)).toContain('size=18')
  })

  it('returns null when remote avatars are disabled', () => {
    setRemoteAvatarsEnabled(false)
    expect(resolveAuthorAvatarUrl(GITHUB_EMAIL, '', 40)).toBeNull()
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, '', 40)).toBeNull()
    setRemoteAvatarsEnabled(true)
    expect(resolveAuthorAvatarUrl(GITHUB_EMAIL, '', 40)).not.toBeNull()
  })
})

describe('avatar source failures', () => {
  it('falls through from GitHub to Gravatar', () => {
    markGithubAvatarLogins({ 'user@example.com': 'torvalds' })
    const github = resolveAuthorAvatarUrl(OTHER_EMAIL, '', 40)!
    markAvatarSourceMissing(OTHER_EMAIL, github)
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, '', 40)).toBe(gravatarUrl(OTHER_EMAIL, 40))
  })

  it('gives up after Gravatar also fails', () => {
    const gravatar = resolveAuthorAvatarUrl(OTHER_EMAIL, '', 40)!
    markAvatarSourceMissing(OTHER_EMAIL, gravatar)
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, '', 40)).toBeNull()
  })

  it('does not retry a failed noreply GitHub avatar', () => {
    const github = resolveAuthorAvatarUrl(GITHUB_EMAIL, '', 40)!
    markAvatarSourceMissing(GITHUB_EMAIL, github)
    expect(resolveAuthorAvatarUrl(GITHUB_EMAIL, githubAvatarUrl(GITHUB_EMAIL), 40)).toBeNull()
  })

  it('falls back to the next source after a caller-provided URL fails', () => {
    const direct = 'https://cdn.example/avatar.png'
    markAvatarSourceMissing(OTHER_EMAIL, direct)
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, direct, 40)).toBe(gravatarUrl(OTHER_EMAIL, 40))
  })

  it('retries misses after a week', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    markAvatarSourceMissing(OTHER_EMAIL, gravatarUrl(OTHER_EMAIL))
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, '', 40)).toBeNull()

    vi.setSystemTime(new Date('2026-01-09T00:00:00Z'))
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, '', 40)).toBe(gravatarUrl(OTHER_EMAIL, 40))
  })
})

describe('cache persistence', () => {
  it('reuses persisted misses after a new session', () => {
    markAvatarSourceMissing(OTHER_EMAIL, gravatarUrl(OTHER_EMAIL))
    resetAvatarSessionForTests()
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, '', 40)).toBeNull()
  })

  it('reuses persisted logins after a new session', () => {
    markGithubAvatarLogins({ 'user@example.com': 'torvalds' })
    resetAvatarSessionForTests()
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, '', 40)).toContain('github.com/torvalds.png')
  })

  it('expires cached logins after 30 days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    markGithubAvatarLogins({ 'user@example.com': 'torvalds' })
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, '', 40)).toContain('torvalds')

    vi.setSystemTime(new Date('2026-02-15T00:00:00Z'))
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, '', 40)).toBe(gravatarUrl(OTHER_EMAIL, 40))
  })

  it('bumps the version when facts change', () => {
    const before = avatarCacheVersion.value
    markGithubAvatarLogins({ 'user@example.com': 'torvalds' })
    expect(avatarCacheVersion.value).toBeGreaterThan(before)
  })

  it('clears cached facts on demand', () => {
    markGithubAvatarLogins({ 'user@example.com': 'torvalds' })
    clearAvatarCache()
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, '', 40)).toBe(gravatarUrl(OTHER_EMAIL, 40))
  })
})
