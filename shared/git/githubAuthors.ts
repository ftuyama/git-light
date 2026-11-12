import { avatarCacheKey } from './avatar'

export interface GithubAuthorLookup {
  /** Normalized commit author email → GitHub login. */
  logins: Record<string, string>
  /** False when pagination stopped early (page cap reached or a page failed). */
  complete: boolean
  /** True when the repository commits could not be read at all (private, missing, rate-limited). */
  unavailable: boolean
}

const GITHUB_API_BASE = 'https://api.github.com'

const GITHUB_AUTHOR_PAGE_SIZE = 100
/** Five pages is 500 commits, matching the default commit-graph depth. */
export const GITHUB_AUTHOR_MAX_PAGES = 5

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

interface GithubCommitPayload {
  author?: { login?: unknown } | null
  commit?: { author?: { email?: unknown } | null } | null
}

function readAuthorPair(item: unknown): { email: string; login: string } | null {
  if (!item || typeof item !== 'object') return null
  const record = item as GithubCommitPayload
  const login = record.author?.login
  const email = record.commit?.author?.email
  if (typeof login !== 'string' || !login.trim()) return null
  if (typeof email !== 'string') return null
  const key = avatarCacheKey(email)
  if (!key) return null
  return { email: key, login: login.trim() }
}

/**
 * Map commit author emails to GitHub logins from a `/repos/{owner}/{repo}/commits`
 * payload. Only emails GitHub already linked to an account appear, so the
 * result is always a subset of the repository's authors.
 */
export function parseGithubAuthorLogins(payload: unknown): Record<string, string> {
  const logins: Record<string, string> = {}
  if (!Array.isArray(payload)) return logins
  for (const item of payload) {
    const pair = readAuthorPair(item)
    if (pair && !logins[pair.email]) logins[pair.email] = pair.login
  }
  return logins
}

/**
 * Read recent commits from the public GitHub REST API and return the email →
 * login map. Unauthenticated: 60 requests/hour, public repositories only.
 */
export async function fetchGithubAuthorLogins(
  owner: string,
  repo: string,
  options: {
    pages?: number
    pageSize?: number
    signal?: AbortSignal
    fetchImpl?: FetchLike
  } = {},
): Promise<GithubAuthorLookup> {
  const pages = Math.max(1, options.pages ?? GITHUB_AUTHOR_MAX_PAGES)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? GITHUB_AUTHOR_PAGE_SIZE))
  const request = options.fetchImpl ?? fetch
  const logins: Record<string, string> = {}

  for (let page = 1; page <= pages; page++) {
    const url =
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` +
      `/commits?per_page=${pageSize}&page=${page}`
    const response = await request(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: options.signal,
    })

    if (!response.ok) {
      return { logins, complete: false, unavailable: true }
    }

    const payload: unknown = await response.json()
    if (!Array.isArray(payload)) {
      return { logins, complete: false, unavailable: true }
    }
    if (payload.length === 0) {
      return { logins, complete: true, unavailable: false }
    }

    const pageLogins = parseGithubAuthorLogins(payload)
    for (const [email, login] of Object.entries(pageLogins)) {
      // Newer commits come first, so an existing mapping is the fresher one.
      if (!logins[email]) logins[email] = login
    }
    if (payload.length < pageSize) {
      return { logins, complete: true, unavailable: false }
    }
  }

  return { logins, complete: false, unavailable: false }
}
