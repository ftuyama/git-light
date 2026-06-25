import type { WireBranch } from '@shared/git/models'

const FIELD = '\x1f'

/**
 * for-each-ref format covering both local and remote branches. Ahead/behind is
 * read from `upstream:track` so we avoid a per-branch `rev-list` call.
 */
export const BRANCH_FORMAT = [
  '%(refname)',
  '%(objectname)',
  '%(HEAD)',
  '%(upstream:short)',
  '%(upstream:track)',
  '%(committerdate:iso-strict)',
].join(FIELD)

export const BRANCH_REFSPECS = ['refs/heads', 'refs/remotes']

function laneColorIndexFor(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return Math.abs(hash) % 8
}

function groupFor(name: string): string {
  return name.includes('/') ? name.split('/')[0] : ''
}

function parseTrack(track: string): { ahead: number; behind: number } {
  let ahead = 0
  let behind = 0
  const aheadMatch = track.match(/ahead (\d+)/)
  const behindMatch = track.match(/behind (\d+)/)
  if (aheadMatch) ahead = Number(aheadMatch[1])
  if (behindMatch) behind = Number(behindMatch[1])
  return { ahead, behind }
}

export function parseBranches(stdout: string, favorites: Set<string>): WireBranch[] {
  const branches: WireBranch[] = []

  for (const lineRaw of stdout.split('\n')) {
    const line = lineRaw.replace(/[\r\n]+$/, '')
    if (!line.trim()) continue

    const [refname, sha, head, upstream, track, date] = line.split(FIELD)

    if (refname.startsWith('refs/heads/')) {
      const name = refname.slice('refs/heads/'.length)
      const { ahead, behind } = parseTrack(track ?? '')
      branches.push({
        id: `local:${name}`,
        name,
        kind: 'local',
        group: groupFor(name),
        tipSha: sha,
        ahead,
        behind,
        isCurrent: head === '*',
        isFavorite: favorites.has(name),
        lastActivity: date ? new Date(date).toISOString() : new Date(0).toISOString(),
        laneColorIndex: laneColorIndexFor(name),
        upstream: upstream || undefined,
      })
    } else if (refname.startsWith('refs/remotes/')) {
      const rest = refname.slice('refs/remotes/'.length)
      // Skip symbolic origin/HEAD.
      if (rest.endsWith('/HEAD')) continue
      const slash = rest.indexOf('/')
      const remote = slash === -1 ? rest : rest.slice(0, slash)
      const name = slash === -1 ? rest : rest.slice(slash + 1)
      branches.push({
        id: `remote:${rest}`,
        name,
        kind: 'remote',
        group: groupFor(name),
        remote,
        tipSha: sha,
        ahead: 0,
        behind: 0,
        isCurrent: false,
        isFavorite: false,
        lastActivity: date ? new Date(date).toISOString() : new Date(0).toISOString(),
        laneColorIndex: laneColorIndexFor(name),
      })
    }
  }

  return branches
}
