import { githubAvatarUrl, initialsFor } from '@shared/git/avatar'
import type { Author } from '@/types/git'

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

export function resolveAuthor(name: string, email: string): Author {
  const key = email.toLowerCase() || name.toLowerCase()
  return {
    name: name || email,
    email,
    avatarUrl: githubAvatarUrl(email),
    initials: initialsFor(name || email),
    color: AVATAR_COLORS[hashString(key) % AVATAR_COLORS.length],
  }
}
