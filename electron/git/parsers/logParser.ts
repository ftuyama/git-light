import { formatRefLabel } from '@shared/git/refLabel'
import type { WireCommit, WireRef } from '@shared/git/models'
import type { AuthorRegistry } from './authors'

const FIELD = '\x1f'
const RECORD = '\x1e'

/**
 * Pretty-format used for `git log`. Fields are unit-separated and records are
 * record-separated so commit bodies (which contain newlines) parse safely.
 */
export const LOG_FORMAT = [
  '%H', // full sha
  '%P', // parent shas (space-separated)
  '%an', // author name
  '%ae', // author email
  '%cn', // committer name
  '%ce', // committer email
  '%at', // author timestamp (unix)
  '%D', // ref decorations
  '%s', // subject
  '%b', // body
].join(FIELD) + RECORD

export const CHERRY_PICK_RE = /\(cherry picked from commit [0-9a-f]+\)/i

function parseRefEntry(entry: string): WireRef | WireRef[] {
  if (entry.startsWith('HEAD -> ')) {
    const branch = entry.slice('HEAD -> '.length).trim()
    return [
      { type: 'head', name: 'HEAD', label: 'HEAD' },
      {
        type: 'localBranch',
        name: branch,
        label: formatRefLabel(branch, 'localBranch'),
        isHead: true,
      },
    ]
  }
  if (entry === 'HEAD') {
    return { type: 'head', name: 'HEAD', label: 'HEAD' }
  }
  if (entry.startsWith('tag: ')) {
    const tag = entry.slice('tag: '.length).trim()
    return { type: 'tag', name: tag, label: formatRefLabel(tag, 'tag') }
  }
  if (entry.startsWith('refs/heads/')) {
    return {
      type: 'localBranch',
      name: entry,
      label: formatRefLabel(entry, 'localBranch'),
    }
  }
  if (entry.startsWith('refs/remotes/')) {
    return {
      type: 'remoteBranch',
      name: entry,
      label: formatRefLabel(entry, 'remoteBranch'),
    }
  }
  if (entry.includes('/')) {
    // Short decorate: origin/main, origin/ENG/bla, etc.
    return {
      type: 'remoteBranch',
      name: entry,
      label: formatRefLabel(entry, 'remoteBranch'),
    }
  }
  return {
    type: 'localBranch',
    name: entry,
    label: formatRefLabel(entry, 'localBranch'),
  }
}

function parseDecorations(raw: string): WireRef[] {
  const refs: WireRef[] = []
  const trimmed = raw.trim()
  if (!trimmed) return refs

  for (const entryRaw of trimmed.split(/,\s*/)) {
    const entry = entryRaw.trim()
    if (!entry) continue
    const parsed = parseRefEntry(entry)
    if (Array.isArray(parsed)) refs.push(...parsed)
    else refs.push(parsed)
  }
  return refs
}

/**
 * Parses raw `git log` output (using {@link LOG_FORMAT}) into wire commits.
 * Author identities are funneled through the shared registry for stable colors.
 */
export function parseCommits(stdout: string, authors: AuthorRegistry): WireCommit[] {
  const commits: WireCommit[] = []
  const records = stdout.split(RECORD)

  for (const record of records) {
    const cleaned = record.replace(/^[\r\n]+/, '')
    if (!cleaned.trim()) continue

    const fields = cleaned.split(FIELD)
    if (fields.length < 10) continue

    const [sha, parentsRaw, an, ae, cn, ce, at, decorations, subject, body] = fields
    const parents = parentsRaw.trim() ? parentsRaw.trim().split(/\s+/) : []
    const bodyText = body?.replace(/\s+$/, '') ?? ''

    commits.push({
      sha,
      shortSha: sha.slice(0, 7),
      parents,
      subject: subject ?? '',
      body: bodyText || undefined,
      author: authors.resolve(an, ae),
      committer: authors.resolve(cn, ce),
      date: new Date(Number(at) * 1000).toISOString(),
      refs: parseDecorations(decorations ?? ''),
      isMerge: parents.length > 1,
      isCherryPick: CHERRY_PICK_RE.test(bodyText),
    })
  }

  return commits
}
