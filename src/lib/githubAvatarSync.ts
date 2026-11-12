import { parseGithubRepoPath } from '@shared/git/githubUrl'
import {
  fetchGithubAuthorLogins,
  GITHUB_AUTHOR_MAX_PAGES,
  type FetchLike,
} from '@shared/git/githubAuthors'
import { isRemoteAvatarsEnabled, markGithubAvatarLogins } from './avatarCache'

const STORAGE_KEY = 'git-light:github-author-sync-v1'
/**
 * A repository is scanned at most once a day: the commits API is capped at 60
 * unauthenticated requests/hour, and start-up refreshes call this repeatedly.
 */
const SCAN_TTL_MS = 24 * 60 * 60 * 1000
const MAX_REPOSITORIES = 200

type RepoScanStore = Record<string, number>

const inFlight = new Map<string, Promise<void>>()
let persisted: RepoScanStore | null = null

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function loadStore(): RepoScanStore {
  if (persisted) return persisted
  if (!hasLocalStorage()) {
    persisted = {}
    return persisted
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    persisted =
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as RepoScanStore)
        : {}
  } catch {
    persisted = {}
  }
  return persisted
}

function persistStore(): void {
  if (!persisted || !hasLocalStorage()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
  } catch {
    // Ignore quota errors — the in-memory scan guard still works this session.
  }
}

function repoKey(owner: string, repo: string): string {
  return `${owner}/${repo}`.toLowerCase()
}

function wasScannedRecently(key: string): boolean {
  const scannedAt = loadStore()[key]
  return typeof scannedAt === 'number' && Date.now() - scannedAt < SCAN_TTL_MS
}

function markScanned(key: string): void {
  const store = loadStore()
  store[key] = Date.now()

  const keys = Object.keys(store)
  if (keys.length > MAX_REPOSITORIES) {
    const byAge = keys.sort((a, b) => (store[a] ?? 0) - (store[b] ?? 0))
    for (const stale of byAge.slice(0, keys.length - MAX_REPOSITORIES)) {
      delete store[stale]
    }
  }

  persistStore()
}

export interface SyncGithubAuthorsOptions {
  pages?: number
  fetchImpl?: FetchLike
}

/**
 * Resolve commit-author emails to GitHub logins for the current repository.
 * Public repositories only; failures are silent and retried on a later
 * snapshot. Concurrent calls for the same repository share one request.
 */
export function syncGithubAuthors(
  remoteUrl: string | null | undefined,
  options: SyncGithubAuthorsOptions = {},
): Promise<void> {
  if (!isRemoteAvatarsEnabled()) return Promise.resolve()

  const parsed = remoteUrl ? parseGithubRepoPath(remoteUrl) : null
  if (!parsed) return Promise.resolve()

  const key = repoKey(parsed.owner, parsed.repo)
  const running = inFlight.get(key)
  if (running) return running
  if (wasScannedRecently(key)) return Promise.resolve()

  const task = (async () => {
    const result = await fetchGithubAuthorLogins(parsed.owner, parsed.repo, {
      pages: options.pages ?? GITHUB_AUTHOR_MAX_PAGES,
      fetchImpl: options.fetchImpl,
    })
    if (Object.keys(result.logins).length > 0) {
      markGithubAvatarLogins(result.logins)
    }
    // Also record unavailable repositories: a private or missing repository
    // must not be re-requested on every snapshot refresh.
    markScanned(key)
  })()
    .catch(() => {
      // Offline or blocked: leave the scan unrecorded so a later refresh retries.
    })
    .finally(() => {
      inFlight.delete(key)
    })

  inFlight.set(key, task)
  return task
}

/** Forget which repositories were scanned, so the next sync fetches again. */
export function resetGithubAuthorSync(): void {
  inFlight.clear()
  persisted = {}
  if (hasLocalStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore storage failures.
    }
  }
}

/** @internal Test helper — drops in-memory state without touching storage. */
export function resetGithubAuthorSyncForTests(): void {
  inFlight.clear()
  persisted = null
}
