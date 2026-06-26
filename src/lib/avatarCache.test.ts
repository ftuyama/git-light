import { beforeEach, describe, expect, it } from 'vitest'
import { githubAvatarUrl } from '@shared/git/avatar'
import {
  clearAvatarCacheForTests,
  markAvatarMissing,
  resetAvatarSessionForTests,
  resolveAuthorAvatarUrl,
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

describe('resolveAuthorAvatarUrl', () => {
  it('returns a GitHub avatar URL for noreply emails', () => {
    expect(resolveAuthorAvatarUrl(GITHUB_EMAIL, '', 40)).toBe(githubAvatarUrl(GITHUB_EMAIL, 40))
  })

  it('returns null for emails without a GitHub username', () => {
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, '', 40)).toBeNull()
  })

  it('uses non-GitHub URLs directly', () => {
    const direct = 'https://cdn.example/avatar.png'
    expect(resolveAuthorAvatarUrl(OTHER_EMAIL, direct, 40)).toBe(direct)
  })

  it('remembers failed loads without retrying', () => {
    markAvatarMissing(GITHUB_EMAIL)
    expect(resolveAuthorAvatarUrl(GITHUB_EMAIL, githubAvatarUrl(GITHUB_EMAIL), 40)).toBeNull()
  })

  it('reuses persisted misses after a new session', () => {
    markAvatarMissing(GITHUB_EMAIL)
    resetAvatarSessionForTests()
    expect(resolveAuthorAvatarUrl(GITHUB_EMAIL, githubAvatarUrl(GITHUB_EMAIL), 40)).toBeNull()
  })
})
