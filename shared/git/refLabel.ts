import type { WireRefType } from '@shared/git/models'

/** Strip git ref prefixes and remote names, leaving a short branch or tag label. */
export function formatRefLabel(name: string, type?: WireRefType): string {
  let label = name.trim()
  if (!label) return label

  if (label.startsWith('refs/remotes/')) {
    label = label.slice('refs/remotes/'.length)
    const slash = label.indexOf('/')
    if (slash !== -1) label = label.slice(slash + 1)
  } else if (label.startsWith('refs/heads/')) {
    label = label.slice('refs/heads/'.length)
  } else if (label.startsWith('refs/tags/')) {
    label = label.slice('refs/tags/'.length)
  } else if (type === 'remoteBranch') {
    const slash = label.indexOf('/')
    if (slash !== -1) label = label.slice(slash + 1)
  }

  return label
}
