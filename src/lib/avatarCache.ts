import { avatarCacheKey, githubAvatarUrl, isGithubAvatarUrl } from '@shared/git/avatar'

export type AvatarCacheStatus = 'found' | 'missing'

const STORAGE_KEY = 'git-light:avatar-cache-v3'
const MAX_CACHE_ENTRIES = 2000

type AvatarCacheStore = Record<string, AvatarCacheStatus>

const memory = new Map<string, AvatarCacheStatus>()

let persisted: AvatarCacheStore | null = null

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function loadStore(): AvatarCacheStore {
  if (persisted) return persisted
  if (!hasLocalStorage()) {
    persisted = {}
    return persisted
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    persisted = raw ? (JSON.parse(raw) as AvatarCacheStore) : {}
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
    // Ignore quota errors — in-memory cache still works for this session.
  }
}

function readStatus(email: string): AvatarCacheStatus | undefined {
  const key = avatarCacheKey(email)
  if (!key) return undefined
  return memory.get(key) ?? loadStore()[key]
}

function writeStatus(email: string, status: AvatarCacheStatus): void {
  const key = avatarCacheKey(email)
  if (!key) return

  memory.set(key, status)

  const store = loadStore()
  store[key] = status

  const keys = Object.keys(store)
  if (keys.length > MAX_CACHE_ENTRIES) {
    for (const stale of keys.slice(0, keys.length - MAX_CACHE_ENTRIES)) {
      delete store[stale]
    }
  }

  persistStore()
}

/** Returns a GitHub avatar URL when one is known for the email, otherwise null. */
export function resolveAuthorAvatarUrl(
  email: string,
  avatarUrl: string,
  size = 80,
): string | null {
  if (readStatus(email) === 'missing') return null

  if (avatarUrl && !isGithubAvatarUrl(avatarUrl)) {
    return avatarUrl
  }

  const url = githubAvatarUrl(email, size) || (isGithubAvatarUrl(avatarUrl) ? avatarUrl : '')
  return url || null
}

/** Record a failed image load so we stop requesting avatars for this email. */
export function markAvatarMissing(email: string): void {
  if (!avatarCacheKey(email)) return
  writeStatus(email, 'missing')
}

/** @internal Test helper — clears in-memory and persisted avatar cache state. */
export function clearAvatarCacheForTests(): void {
  memory.clear()
  persisted = null
  if (hasLocalStorage()) localStorage.removeItem(STORAGE_KEY)
}

/** @internal Test helper — drops in-memory state while keeping persisted entries. */
export function resetAvatarSessionForTests(): void {
  memory.clear()
  persisted = null
}
