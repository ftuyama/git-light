import { translate } from '@/locales'
import type { GitAction } from '@/types/git'

export { scopesForAction } from '@shared/git/snapshotScopes'

export function describeAction(action: GitAction): string {
  const target = action.target ? ` "${action.target}"` : ''
  const params = { action: action.kind, target }
  switch (action.kind) {
    case 'force-push':
    case 'commit-and-force-push':
      return translate('shell.operations.describe.forcePush', params)
    case 'discard-file':
    case 'discard-all':
    case 'discard-patch':
      return translate('shell.operations.describe.discard', params)
    case 'drop-stash':
      return translate('shell.operations.describe.dropStash', params)
    case 'reset-hard':
      return translate('shell.operations.describe.resetHard', params)
    default:
      return translate('shell.operations.describe.fallback', params)
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
      return translate('shell.operations.progress.fetching')
    case 'pull':
      return translate('shell.operations.progress.pulling')
    case 'push':
      return translate('shell.operations.progress.pushing')
    case 'force-push':
      return translate('shell.operations.progress.forcePushing')
    case 'sync':
      return translate('shell.operations.progress.syncing')
    case 'commit-and-push':
      return translate('shell.operations.progress.committingAndPushing')
    case 'commit-and-force-push':
      return translate('shell.operations.progress.committingAndForcePushing')
    case 'rebase':
    case 'interactive-rebase':
    case 'rebase-from-here':
      return translate('shell.operations.progress.rebasing')
    case 'merge':
      return translate('shell.operations.progress.merging')
    case 'lfs-track':
    case 'lfs-untrack':
    case 'lfs-prune':
      return translate('shell.operations.progress.lfs')
    case 'bisect-start':
    case 'bisect-good':
    case 'bisect-bad':
    case 'bisect-skip':
    case 'bisect-reset':
      return translate('shell.operations.progress.bisecting')
    case 'checkout':
      return translate('shell.operations.progress.switchingTo', {
        branch: action.target ?? translate('common.labels.branch'),
      })
    case 'checkout-commit':
      return translate('shell.operations.progress.checkingOutCommit')
    case 'checkout-tag':
      return translate('shell.operations.progress.checkingOutTag', {
        tag: action.target ?? translate('common.labels.tag'),
      })
    case 'create-branch':
      return translate('shell.operations.progress.creatingBranch', {
        branch: String(action.meta?.name ?? translate('common.labels.branch')),
      })
    default:
      return null
  }
}
