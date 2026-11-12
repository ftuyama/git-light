import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveAuthorAvatarUrl, setRemoteAvatarsEnabled } from './avatarCache'
import { resetGithubAuthorSyncForTests, resetGithubAuthorSync, syncGithubAuthors } from './githubAvatarSync'
import type { FetchLike } from '@shared/git/githubAuthors'

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

function commit(email: string, login: string) {
  return {
    sha: 'abc',
    author: { login },
    commit: { author: { email, name: 'Someone' } },
  }
}

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 404, json: async () => body } as Response
}

const GITHUB_REMOTE = 'git@github.com:FelipeTuyama/git-light.git'

beforeEach(() => {
  globalThis.localStorage = mockLocalStorage()
  resetGithubAuthorSync()
  resetGithubAuthorSyncForTests()
  setRemoteAvatarsEnabled(true)
  localStorage.clear()
})

describe('syncGithubAuthors', () => {
  it('maps author emails to GitHub avatars for a GitHub remote', async () => {
    const fetchImpl: FetchLike = vi.fn(async () =>
      jsonResponse([commit('author@example.com', 'author')]),
    )

    await syncGithubAuthors(GITHUB_REMOTE, { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(resolveAuthorAvatarUrl('author@example.com', '', 20)).toContain(
      'github.com/author.png?size=20',
    )
  })

  it('ignores non-GitHub remotes', async () => {
    const fetchImpl: FetchLike = vi.fn()
    await syncGithubAuthors('git@gitlab.com:owner/repo.git', { fetchImpl })
    await syncGithubAuthors('', { fetchImpl })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('shares one request between concurrent calls', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse([commit('a@example.com', 'a')]))

    const first = syncGithubAuthors(GITHUB_REMOTE, { fetchImpl })
    const second = syncGithubAuthors(GITHUB_REMOTE, { fetchImpl })
    expect(first).toBe(second)
    await Promise.all([first, second])

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('does not rescan a repository within the TTL', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse([commit('a@example.com', 'a')]))

    await syncGithubAuthors(GITHUB_REMOTE, { fetchImpl })
    await syncGithubAuthors(GITHUB_REMOTE, { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('records unavailable repositories so they are not requested again', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse({ message: 'Not Found' }, false))

    await syncGithubAuthors(GITHUB_REMOTE, { fetchImpl })
    await syncGithubAuthors(GITHUB_REMOTE, { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries after an offline failure', async () => {
    const failing: FetchLike = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await syncGithubAuthors(GITHUB_REMOTE, { fetchImpl: failing })

    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse([commit('a@example.com', 'a')]))
    await syncGithubAuthors(GITHUB_REMOTE, { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('does nothing while remote avatars are disabled', async () => {
    setRemoteAvatarsEnabled(false)
    const fetchImpl: FetchLike = vi.fn()

    await syncGithubAuthors(GITHUB_REMOTE, { fetchImpl })

    expect(fetchImpl).not.toHaveBeenCalled()
    setRemoteAvatarsEnabled(true)
  })

  it('refetches after the sync cache is reset', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse([]))

    await syncGithubAuthors(GITHUB_REMOTE, { fetchImpl })
    resetGithubAuthorSync()
    await syncGithubAuthors(GITHUB_REMOTE, { fetchImpl })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
