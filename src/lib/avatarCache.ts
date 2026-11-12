import { ref } from 'vue'
import {
  avatarCacheKey,
  githubAvatarUrlForUsername,
  githubUsernameFromEmail,
  gravatarUrl,
  isGithubAvatarUrl,
  isGravatarUrl,
} from '@shared/git/avatar'

/** Cached facts about one commit author email, per avatar source. */
export interface AvatarCacheEntry {
  /** GitHub login discovered through the repository commits API. */
  login?: string
  loginCheckedAt?: number
  githubMissingAt?: number
  gravatarMissingAt?: number
  /** A caller-provided avatar URL that failed to load. */
  directMissingAt?: number
}

const STORAGE_KEY = 'git-light:avatar-cache-v4'
const LEGACY_STORAGE_KEYS = ['git-light:avatar-cache-v3']
const MAX_CACHE_ENTRIES = 2000
const LOGIN_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000

type AvatarCacheStore = Record<string, AvatarCacheEntry>

const memory = new Map<string, AvatarCacheEntry>()

let persisted: AvatarCacheStore | null = null
let remoteAvatarsEnabled = true

/** Bumped whenever cached facts change, so mounted avatars can re-resolve. */
export const avatarCacheVersion = ref(0)

function bumpVersion(): void {
  avatarCacheVersion.value += 1
}

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function isStore(value: unknown): value is AvatarCacheStore {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function loadStore(): AvatarCacheStore {
  if (persisted) return persisted
  if (!hasLocalStorage()) {
    persisted = {}
    return persisted
  }
  try {
    for (const legacy of LEGACY_STORAGE_KEYS) localStorage.removeItem(legacy)
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    persisted = isStore(parsed) ? parsed : {}
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
    // Ignore quota errors — the in-memory cache still works for this session.
  }
}

function trimStore(store: AvatarCacheStore): void {
  const keys = Object.keys(store)
  if (keys.length <= MAX_CACHE_ENTRIES) return
  for (const stale of keys.slice(0, keys.length - MAX_CACHE_ENTRIES)) {
    delete store[stale]
  }
}

function readEntry(key: string): AvatarCacheEntry | undefined {
  return memory.get(key) ?? loadStore()[key]
}

function writeEntry(key: string, patch: AvatarCacheEntry): void {
  const next = { ...(readEntry(key) ?? {}), ...patch }
  memory.set(key, next)
  const store = loadStore()
  store[key] = next
  trimStore(store)
  persistStore()
  bumpVersion()
}

function isFresh(timestamp: number | undefined): boolean {
  return timestamp !== undefined && Date.now() - timestamp < MISS_TTL_MS
}

function cachedLogin(entry: AvatarCacheEntry | undefined): string | null {
  if (!entry?.login || entry.loginCheckedAt === undefined) return null
  return Date.now() - entry.loginCheckedAt < LOGIN_TTL_MS ? entry.login : null
}

/**
 * Resolve the best avatar URL for a commit author, in GitKraken-like order:
 * explicit provider URL → GitHub login → Gravatar → none (initials).
 */
export function resolveAuthorAvatarUrl(
  email: string,
  avatarUrl: string,
  size = 80,
): string | null {
  if (!remoteAvatarsEnabled) return null

  const key = avatarCacheKey(email)
  if (!key) return null
  const entry = readEntry(key)

  if (avatarUrl && !isGithubAvatarUrl(avatarUrl) && !isFresh(entry?.directMissingAt)) {
    return avatarUrl
  }

  const noreplyLogin = githubUsernameFromEmail(email)
  const login = noreplyLogin ?? cachedLogin(entry)
  if (login && !isFresh(entry?.githubMissingAt)) {
    return githubAvatarUrlForUsername(login, size)
  }

  if (avatarUrl && isGithubAvatarUrl(avatarUrl) && !isFresh(entry?.githubMissingAt)) {
    return avatarUrl
  }

  // Noreply addresses are synthetic: they never have a Gravatar.
  if (!noreplyLogin && !isFresh(entry?.gravatarMissingAt)) {
    return gravatarUrl(email, size)
  }

  return null
}

/** Merge a bulk email → login map from the GitHub commits API. */
export function markGithubAvatarLogins(logins: Record<string, string>): void {
  const now = Date.now()
  const store = loadStore()
  let changed = false

  for (const [email, login] of Object.entries(logins)) {
    const key = avatarCacheKey(email)
    if (!key || !login.trim()) continue
    const next: AvatarCacheEntry = {
      ...(readEntry(key) ?? {}),
      login: login.trim(),
      loginCheckedAt: now,
    }
    memory.set(key, next)
    store[key] = next
    changed = true
  }

  if (!changed) return
  trimStore(store)
  persistStore()
  bumpVersion()
}

/** Record that an image URL failed, scoped to the source that failed. */
export function markAvatarSourceMissing(email: string, url: string): void {
  const key = avatarCacheKey(email)
  if (!key || !url) return

  if (isGithubAvatarUrl(url)) {
    writeEntry(key, { githubMissingAt: Date.now() })
  } else if (isGravatarUrl(url)) {
    writeEntry(key, { gravatarMissingAt: Date.now() })
  } else {
    writeEntry(key, { directMissingAt: Date.now() })
  }
}

/** Turn remote avatar lookups off (initials only) or back on. */
export function setRemoteAvatarsEnabled(enabled: boolean): void {
  if (remoteAvatarsEnabled === enabled) return
  remoteAvatarsEnabled = enabled
  bumpVersion()
}

export function isRemoteAvatarsEnabled(): boolean {
  return remoteAvatarsEnabled
}

/** Drop every cached lookup so the next render asks the network again. */
export function clearAvatarCache(): void {
  memory.clear()
  persisted = {}
  if (hasLocalStorage()) {
    for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
      try {
        localStorage.removeItem(key)
      } catch {
        // Ignore storage failures.
      }
    }
  }
  bumpVersion()
}

/** @internal Test helper — clears cache state and restores the default toggle. */
export function clearAvatarCacheForTests(): void {
  clearAvatarCache()
  remoteAvatarsEnabled = true
}

/** @internal Test helper — drops in-memory state while keeping persisted entries. */
export function resetAvatarSessionForTests(): void {
  memory.clear()
  persisted = null
}
