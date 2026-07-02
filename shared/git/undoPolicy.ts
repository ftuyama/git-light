import type { GitAction, GitActionKind } from './actions'

/** What to snapshot before a journalable action runs. */
export type JournalCapture = 'head' | 'index'

const JOURNALABLE: Partial<Record<GitActionKind, JournalCapture>> = {
  commit: 'head',
  amend: 'head',
  'commit-and-push': 'head',
  'commit-and-force-push': 'head',
  merge: 'head',
  'merge-continue': 'head',
  rebase: 'head',
  'rebase-from-here': 'head',
  'interactive-rebase': 'head',
  'rebase-continue': 'head',
  'cherry-pick': 'head',
  'cherry-pick-continue': 'head',
  revert: 'head',
  'revert-continue': 'head',
  'reset-soft': 'head',
  'reset-mixed': 'head',
  'reset-hard': 'head',
  checkout: 'head',
  'checkout-commit': 'head',
  'checkout-tag': 'head',
  'create-branch': 'head',
  'pop-stash': 'head',
  'apply-stash': 'head',
  stash: 'index',
  stage: 'index',
  unstage: 'index',
  'stage-all': 'index',
  'unstage-all': 'index',
  'stage-patch': 'index',
  'unstage-patch': 'index',
  'resolve-conflict-ours': 'index',
  'resolve-conflict-theirs': 'index',
  'resolve-conflict-block': 'index',
  'mark-conflict-resolved': 'index',
}

export function journalCaptureFor(kind: GitActionKind): JournalCapture | null {
  return JOURNALABLE[kind] ?? null
}

export function isJournalableAction(kind: GitActionKind): boolean {
  return kind in JOURNALABLE
}

export function journalLabel(action: GitAction): string {
  const target = action.target
  switch (action.kind) {
    case 'commit':
      return 'Commit'
    case 'amend':
      return 'Amend commit'
    case 'commit-and-push':
      return 'Commit and push'
    case 'commit-and-force-push':
      return 'Commit and force push'
    case 'merge':
    case 'merge-continue':
      return target ? `Merge ${target}` : 'Merge'
    case 'rebase':
    case 'rebase-continue':
      return target ? `Rebase onto ${target}` : 'Rebase'
    case 'rebase-from-here':
      return 'Rebase from commit'
    case 'interactive-rebase':
      return 'Interactive rebase'
    case 'cherry-pick':
    case 'cherry-pick-continue':
      return target ? `Cherry-pick ${target.slice(0, 7)}` : 'Cherry-pick'
    case 'revert':
    case 'revert-continue':
      return target ? `Revert ${target.slice(0, 7)}` : 'Revert'
    case 'reset-soft':
      return 'Soft reset'
    case 'reset-mixed':
      return 'Mixed reset'
    case 'reset-hard':
      return 'Hard reset'
    case 'checkout':
      return target ? `Checkout ${target}` : 'Checkout'
    case 'checkout-commit':
      return target ? `Checkout ${target.slice(0, 7)}` : 'Checkout commit'
    case 'checkout-tag':
      return target ? `Checkout tag ${target}` : 'Checkout tag'
    case 'create-branch':
      return String(action.meta?.name ?? action.target ?? 'branch')
        ? `Create branch ${String(action.meta?.name ?? action.target)}`
        : 'Create branch'
    case 'stash':
      return 'Stash changes'
    case 'pop-stash':
      return 'Pop stash'
    case 'apply-stash':
      return 'Apply stash'
    case 'stage':
    case 'stage-patch':
      return target ? `Stage ${target}` : 'Stage file'
    case 'unstage':
    case 'unstage-patch':
      return target ? `Unstage ${target}` : 'Unstage file'
    case 'stage-all':
      return 'Stage all'
    case 'unstage-all':
      return 'Unstage all'
    case 'resolve-conflict-ours':
    case 'resolve-conflict-theirs':
    case 'resolve-conflict-block':
    case 'mark-conflict-resolved':
      return target ? `Resolve ${target}` : 'Resolve conflict'
    default:
      return action.kind
  }
}
