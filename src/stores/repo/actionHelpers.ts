import type { GitAction } from '@/types/git'

export { scopesForAction } from '@shared/git/snapshotScopes'

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
