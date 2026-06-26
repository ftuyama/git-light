import type { GitAction } from '@/types/git'
import type { SnapshotScope } from '@shared/git/models'

export function describeAction(action: GitAction): string {
  const target = action.target ? ` "${action.target}"` : ''
  return `Are you sure you want to run ${action.kind}${target}? This cannot be undone.`
}

export function isBranchSwitchAction(kind: GitAction['kind']): boolean {
  return kind === 'checkout' || kind === 'checkout-commit' || kind === 'checkout-tag'
}

export function labelForOperation(action: GitAction): string | null {
  switch (action.kind) {
    case 'fetch':
    case 'fetch-all':
      return 'Fetching...'
    case 'pull':
      return 'Pulling...'
    case 'push':
    case 'force-push':
      return 'Pushing...'
    case 'sync':
      return 'Syncing...'
    case 'commit-and-push':
      return 'Committing and pushing...'
    case 'commit-and-force-push':
      return 'Committing and force-pushing...'
    case 'rebase':
    case 'interactive-rebase':
    case 'rebase-from-here':
      return 'Rebasing...'
    case 'merge':
      return 'Merging...'
    case 'checkout':
      return `Switching to ${action.target ?? 'branch'}...`
    case 'checkout-commit':
      return 'Checking out commit...'
    case 'checkout-tag':
      return `Checking out ${action.target ?? 'tag'}...`
    default:
      return null
  }
}

export function scopesForAction(kind: GitAction['kind']): SnapshotScope[] | undefined {
  if (kind.startsWith('reset') || kind.includes('rebase') || kind.includes('merge') || kind.includes('cherry')) {
    return ['commits', 'branches', 'status']
  }
  if (kind.includes('branch') || kind === 'checkout' || kind === 'checkout-commit' || kind === 'checkout-tag') {
    return ['commits', 'branches', 'status']
  }
  if (kind === 'commit' || kind === 'amend' || kind === 'commit-and-push' || kind === 'commit-and-force-push') {
    return ['commits', 'status']
  }
  if (kind.includes('stage') || kind === 'stash' || kind.includes('discard') || kind.includes('conflict')) {
    return ['status']
  }
  if (kind === 'fetch' || kind === 'pull' || kind === 'push' || kind === 'sync' || kind === 'fetch-all') {
    return ['branches', 'commits', 'status']
  }
  if (kind === 'create-tag' || kind === 'delete-tag' || kind === 'tag') return ['tags', 'commits']
  if (kind.includes('stash')) return ['stashes', 'status']
  if (kind === 'refresh') return undefined
  if (kind === 'undo' || kind === 'redo') return ['commits', 'branches', 'status']
  return ['status', 'branches']
}
