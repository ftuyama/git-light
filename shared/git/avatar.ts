import { md5Hex } from './md5'

const MIN_AVATAR_SIZE = 1
const MAX_AVATAR_SIZE = 460

function clampAvatarSize(size: number): number {
  return Math.min(MAX_AVATAR_SIZE, Math.max(MIN_AVATAR_SIZE, Math.round(size)))
}

/** Extract a GitHub username from a commit author email, when GitHub exposes one. */
export function githubUsernameFromEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase()
  const match = normalized.match(/^(?:\d+\+)?([^@+]+)@users\.noreply\.github\.com$/)
  return match?.[1] ?? null
}

/** GitHub profile image URL for a known login, sized for display. */
export function githubAvatarUrlForUsername(username: string, size = 80): string {
  const login = username.trim()
  if (!login) return ''
  return `https://github.com/${encodeURIComponent(login)}.png?size=${clampAvatarSize(size)}`
}

/** GitHub profile image URL for a commit author email, or empty when unknown. */
export function githubAvatarUrl(email: string, size = 80): string {
  const username = githubUsernameFromEmail(email)
  return username ? githubAvatarUrlForUsername(username, size) : ''
}

/**
 * Gravatar URL for a commit author email. `d=404` makes missing avatars fail
 * the request instead of returning a placeholder, so the UI can fall back to
 * initials and remember the miss.
 */
export function gravatarUrl(email: string, size = 80): string {
  const normalized = avatarCacheKey(email)
  if (!normalized) return ''
  return `https://gravatar.com/avatar/${md5Hex(normalized)}?d=404&r=pg&size=${clampAvatarSize(size)}`
}

export function isGithubAvatarUrl(url: string): boolean {
  return url.includes('github.com/') && url.includes('.png')
}

export function isGravatarUrl(url: string): boolean {
  return /^https:\/\/(?:www\.|secure\.)?gravatar\.com\/avatar\//i.test(url)
}

export function avatarCacheKey(email: string): string {
  return email.trim().toLowerCase()
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
