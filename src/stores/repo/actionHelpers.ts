import type { GitAction } from '@/types/git'

export { scopesForAction } from '@shared/git/snapshotScopes'

export function describeAction(action: GitAction): string {
  const target = action.target ? ` "${action.target}"` : ''
  switch (action.kind) {
    case 'force-push':
    case 'commit-and-force-push':
      return `Are you sure you want to run ${action.kind}${target}? Uses --force-with-lease to protect unpulled remote work. This cannot be undone.`
    case 'discard-file':
    case 'discard-all':
    case 'discard-patch':
      return `Are you sure you want to run ${action.kind}${target}? Working-tree changes will be lost permanently and cannot be undone.`
    case 'drop-stash':
      return `Are you sure you want to drop stash${target}? The stash entry will be permanently deleted and cannot be undone.`
    case 'reset-hard':
      return `Are you sure you want to run reset-hard${target}? Working-tree changes will be lost. HEAD can be restored with Undo.`
    default:
      return `Are you sure you want to run ${action.kind}${target}? This cannot be undone.`
  }
}

export function isBranchSwitchAction(kind: GitAction['kind']): boolean {
  return (
    kind === 'checkout' ||
    kind === 'checkout-commit' ||
    kind === 'checkout-tag' ||
    kind === 'create-branch'
  )
}

export function labelForOperation(action: GitAction): string | null {
  switch (action.kind) {
    case 'fetch':
    case 'fetch-all':
      return 'Fetching...'
    case 'pull':
      return 'Pulling...'
    case 'push':
      return 'Pushing...'
    case 'force-push':
      return 'Force-pushing (with lease)...'
    case 'sync':
      return 'Syncing...'
    case 'commit-and-push':
      return 'Committing and pushing...'
    case 'commit-and-force-push':
      return 'Committing and force-pushing (with lease)...'
    case 'rebase':
    case 'interactive-rebase':
    case 'rebase-from-here':
      return 'Rebasing...'
    case 'merge':
      return 'Merging...'
    case 'lfs-track':
    case 'lfs-untrack':
    case 'lfs-prune':
      return 'Updating Git LFS...'
    case 'bisect-start':
    case 'bisect-good':
    case 'bisect-bad':
    case 'bisect-skip':
    case 'bisect-reset':
      return 'Bisecting...'
    case 'checkout':
      return `Switching to ${action.target ?? 'branch'}...`
    case 'checkout-commit':
      return 'Checking out commit...'
    case 'checkout-tag':
      return `Checking out ${action.target ?? 'tag'}...`
    case 'create-branch':
      return `Switching to ${String(action.meta?.name ?? 'branch')}...`
    default:
      return null
  }
}
