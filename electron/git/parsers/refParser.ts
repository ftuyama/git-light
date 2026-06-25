import type { WireRemote, WireTag } from '@shared/git/models'

const FIELD = '\x1f'

/**
 * Tag format. `*` fields dereference annotated tags to the commit they point
 * at; lightweight tags fall back to the object fields.
 */
export const TAG_FORMAT = [
  '%(refname:short)',
  '%(objectname)', // tag object (annotated) or commit (lightweight)
  '%(*objectname)', // dereferenced commit for annotated tags
  '%(objecttype)',
  '%(creatordate:iso-strict)',
  '%(contents:subject)',
].join(FIELD)

export function parseTags(stdout: string): WireTag[] {
  const tags: WireTag[] = []
  for (const lineRaw of stdout.split('\n')) {
    const line = lineRaw.replace(/[\r\n]+$/, '')
    if (!line.trim()) continue
    const [name, objectName, derefName, objectType, date, subject] = line.split(FIELD)
    const annotated = objectType === 'tag'
    tags.push({
      id: `tag:${name}`,
      name,
      sha: (annotated && derefName) || objectName,
      message: subject ?? '',
      date: date ? new Date(date).toISOString() : new Date(0).toISOString(),
      annotated,
    })
  }
  return tags
}

/** Parses `git remote -v` into deduplicated fetch/push URLs per remote. */
export function parseRemotes(stdout: string): WireRemote[] {
  const map = new Map<string, WireRemote>()
  for (const lineRaw of stdout.split('\n')) {
    const line = lineRaw.trim()
    if (!line) continue
    const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/)
    if (!match) continue
    const [, name, url, kind] = match
    const existing = map.get(name) ?? { name, fetchUrl: '', pushUrl: '' }
    if (kind === 'fetch') existing.fetchUrl = url
    else existing.pushUrl = url
    map.set(name, existing)
  }
  return [...map.values()]
}
