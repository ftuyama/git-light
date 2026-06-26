import type { GitActionKind } from './actions'
import type { SnapshotScope } from './models'

/** Snapshot scopes to refresh after a git action. `undefined` means full refresh. */
export function scopesForAction(kind: GitActionKind): SnapshotScope[] | undefined {
  if (kind === 'refresh') return undefined

  if (kind.startsWith('reset') || kind.includes('rebase') || kind.includes('merge') || kind.includes('cherry')) {
    return ['commits', 'branches', 'status']
  }
  if (kind.includes('branch') || kind === 'checkout' || kind === 'checkout-commit' || kind === 'checkout-tag') {
    return ['commits', 'branches', 'status']
  }
  if (kind === 'commit' || kind === 'amend' || kind === 'commit-and-push' || kind === 'commit-and-force-push') {
    return ['commits', 'status']
  }
  if (kind.includes('stash')) return ['stashes', 'status']
  if (kind.includes('stage') || kind.includes('discard') || kind.includes('conflict')) {
    return ['status']
  }
  if (kind === 'fetch' || kind === 'pull' || kind === 'push' || kind === 'sync' || kind === 'fetch-all') {
    return ['branches', 'commits', 'status']
  }
  if (kind === 'create-tag' || kind === 'delete-tag' || kind === 'tag') return ['tags', 'commits']
  if (kind === 'undo' || kind === 'redo') return ['commits', 'branches', 'status']
  return ['status', 'branches']
}
