/** Extract a GitHub username from a commit author email, when GitHub exposes one. */
export function githubUsernameFromEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase()
  const match = normalized.match(/^(?:\d+\+)?([^@+]+)@users\.noreply\.github\.com$/)
  return match?.[1] ?? null
}

/** GitHub profile image URL for a commit author email, or empty when unknown. */
export function githubAvatarUrl(email: string, size = 80): string {
  const username = githubUsernameFromEmail(email)
  if (!username) return ''
  const px = Math.min(460, Math.max(1, Math.round(size)))
  return `https://github.com/${encodeURIComponent(username)}.png?size=${px}`
}

export function isGithubAvatarUrl(url: string): boolean {
  return url.includes('github.com/') && url.includes('.png')
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
