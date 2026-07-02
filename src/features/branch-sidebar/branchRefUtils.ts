import { formatRefLabel } from '@shared/git/refLabel'
import type { Branch, Ref } from '@/types/git'

/** Normalize a remote ref name to `remote/branch` (e.g. `origin/main`). */
export function remoteRefKey(name: string): string {
  if (name.startsWith('refs/remotes/')) {
    return name.slice('refs/remotes/'.length)
  }
  return name
}

export function findBranchForRef(ref: Ref, branches: Branch[]): Branch | undefined {
  if (ref.type === 'localBranch') {
    const name = formatRefLabel(ref.name, ref.type)
    return branches.find((b) => b.kind === 'local' && b.name === name)
  }
  if (ref.type === 'remoteBranch') {
    const key = remoteRefKey(ref.name)
    return branches.find((b) => b.kind === 'remote' && `${b.remote}/${b.name}` === key)
  }
  return undefined
}

/** Best-effort branch model for context menus when the sidebar list has not synced yet. */
export function branchFromRef(ref: Ref, branches: Branch[]): Branch | undefined {
  const found = findBranchForRef(ref, branches)
  if (found) return found

  if (ref.type === 'localBranch') {
    const name = formatRefLabel(ref.name, ref.type)
    return {
      id: `local:${name}`,
      name,
      kind: 'local',
      group: name.includes('/') ? name.split('/')[0] : '',
      tipSha: '',
      ahead: 0,
      behind: 0,
      isCurrent: ref.isHead === true,
      isFavorite: false,
      lastActivity: new Date(0),
      laneColorIndex: 0,
    }
  }

  if (ref.type === 'remoteBranch') {
    const key = remoteRefKey(ref.name)
    const slash = key.indexOf('/')
    if (slash === -1) return undefined
    const remote = key.slice(0, slash)
    const name = key.slice(slash + 1)
    return {
      id: `remote:${key}`,
      name,
      kind: 'remote',
      group: name.includes('/') ? name.split('/')[0] : '',
      remote,
      tipSha: '',
      ahead: 0,
      behind: 0,
      isCurrent: false,
      isFavorite: false,
      lastActivity: new Date(0),
      laneColorIndex: 0,
    }
  }

  return undefined
}
