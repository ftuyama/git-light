import type { WireAuthor } from '@shared/git/models'

const AVATAR_COLORS = [
  '#a371f7',
  '#3fb950',
  '#58a6ff',
  '#f0883e',
  '#db61a2',
  '#e3b341',
  '#56d4dd',
  '#ff7b72',
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Deduplicates authors by email and assigns each a stable avatar color so the
 * same person always renders identically across the UI.
 */
export class AuthorRegistry {
  private byEmail = new Map<string, WireAuthor>()

  resolve(name: string, email: string): WireAuthor {
    const key = email.toLowerCase() || name.toLowerCase()
    const existing = this.byEmail.get(key)
    if (existing) return existing

    const author: WireAuthor = {
      name: name || email,
      email,
      avatarUrl: '',
      initials: initialsFor(name || email),
      color: AVATAR_COLORS[hashString(key) % AVATAR_COLORS.length],
    }
    this.byEmail.set(key, author)
    return author
  }

  all(): WireAuthor[] {
    return [...this.byEmail.values()]
  }
}
