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

function parseRefEntry(entry: string): WireRef | WireRef[] | null {
  if (entry === 'refs/stash' || /^stash(@\{.*\})?$/.test(entry)) {
    return { type: 'stash', name: entry, label: 'stash' }
  }
  if (entry.startsWith('HEAD -> ')) {
    const branch = entry.slice('HEAD -> '.length).trim()
    // HEAD pseudo-ref oculto da visualização — a branch atual segue
    // indicada via `isHead: true`.
    return {
      type: 'localBranch',
      name: branch,
      label: formatRefLabel(branch, 'localBranch'),
      isHead: true,
    }
  }
  if (entry === 'HEAD') {
    // Detached HEAD oculto da visualização de commits.
    return null
  }
  if (entry.startsWith('tag: ')) {
    const raw = entry.slice('tag: '.length).trim()
    const tag = raw.startsWith('refs/tags/') ? raw.slice('refs/tags/'.length) : raw
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
    // Symbolic origin/HEAD oculto da visualização.
    const rest = entry.slice('refs/remotes/'.length)
    if (rest === 'HEAD' || rest.endsWith('/HEAD')) return null
    return {
      type: 'remoteBranch',
      name: entry,
      label: formatRefLabel(entry, 'remoteBranch'),
    }
  }
  if (entry.includes('/')) {
    // Short decorate: origin/main, origin/ENG/bla, etc.
    // Symbolic origin/HEAD oculto da visualização.
    if (entry.endsWith('/HEAD')) return null
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

  for (const entryRaw of trimmed.split(', ')) {
    const entry = entryRaw.trim()
    if (!entry) continue
    const parsed = parseRefEntry(entry)
    if (parsed == null) continue
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
    if (!sha) continue
    const parents = parentsRaw.trim() ? parentsRaw.trim().split(/\s+/) : []
    const bodyText = body?.replace(/\s+$/, '') ?? ''
    const timestamp = Number(at)
    if (!Number.isFinite(timestamp)) continue

    commits.push({
      sha,
      shortSha: sha.slice(0, 7),
      parents,
      subject: subject ?? '',
      body: bodyText || undefined,
      author: authors.resolve(an, ae),
      committer: authors.resolve(cn, ce),
      date: new Date(timestamp * 1000).toISOString(),
      refs: parseDecorations(decorations ?? ''),
      isMerge: parents.length > 1,
      isCherryPick: CHERRY_PICK_RE.test(bodyText),
    })
  }

  return commits
}
