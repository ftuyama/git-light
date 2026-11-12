import { describe, expect, it, vi } from 'vitest'
import {
  fetchGithubAuthorLogins,
  parseGithubAuthorLogins,
  type FetchLike,
} from './githubAuthors'

function commit(email: string | null, login: string | null) {
  return {
    sha: 'abc',
    author: login === null ? null : { login },
    commit: { author: email === null ? null : { email, name: 'Someone' } },
  }
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response
}

describe('parseGithubAuthorLogins', () => {
  it('maps normalized emails to logins', () => {
    expect(
      parseGithubAuthorLogins([
        commit('Ada@Example.com ', 'ada'),
        commit('grace@example.com', 'grace-hopper'),
      ]),
    ).toEqual({ 'ada@example.com': 'ada', 'grace@example.com': 'grace-hopper' })
  })

  it('skips commits GitHub did not link to an account', () => {
    expect(parseGithubAuthorLogins([commit('old@example.com', null)])).toEqual({})
  })

  it('skips entries without an email or login', () => {
    expect(parseGithubAuthorLogins([commit(null, 'ada'), commit('ada@example.com', '  ')])).toEqual(
      {},
    )
  })

  it('keeps the newest mapping when an email repeats', () => {
    expect(
      parseGithubAuthorLogins([
        commit('ada@example.com', 'ada-new'),
        commit('ada@example.com', 'ada-old'),
      ]),
    ).toEqual({ 'ada@example.com': 'ada-new' })
  })

  it('ignores non-array payloads', () => {
    expect(parseGithubAuthorLogins({ message: 'Not Found' })).toEqual({})
  })
})

describe('fetchGithubAuthorLogins', () => {
  it('requests the expected pages and merges results', async () => {
    const urls: string[] = []
    const fetchImpl: FetchLike = vi.fn(async (url: string) => {
      urls.push(url)
      return pageNumber(url) === 1
        ? jsonResponse([commit('ada@example.com', 'ada')])
        : jsonResponse([])
    })

    const result = await fetchGithubAuthorLogins('octo', 'hello', { fetchImpl, pages: 3 })

    expect(urls).toEqual([
      'https://api.github.com/repos/octo/hello/commits?per_page=100&page=1',
    ])
    expect(result).toEqual({
      logins: { 'ada@example.com': 'ada' },
      complete: true,
      unavailable: false,
    })
  })

  it('stops after the page cap', async () => {
    const fetchImpl: FetchLike = vi.fn(async (url: string) =>
      jsonResponse([commit(`user${pageNumber(url)}@example.com`, `user${pageNumber(url)}`)]),
    )

    const result = await fetchGithubAuthorLogins('octo', 'hello', {
      fetchImpl,
      pages: 2,
      pageSize: 1,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(Object.keys(result.logins)).toEqual(['user1@example.com', 'user2@example.com'])
    expect(result.complete).toBe(false)
    expect(result.unavailable).toBe(false)
  })

  it('marks unreachable repositories as unavailable', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => jsonResponse({ message: 'Not Found' }, false, 404))

    const result = await fetchGithubAuthorLogins('octo', 'private', { fetchImpl })

    expect(result).toEqual({ logins: {}, complete: false, unavailable: true })
  })
})

function pageNumber(url: string): number {
  return Number(new URL(url).searchParams.get('page') ?? '1')
}
