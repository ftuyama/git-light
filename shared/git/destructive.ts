import type { GitActionKind } from './actions'

const DESTRUCTIVE = new Set<GitActionKind>([
  'reset-hard',
  'force-push',
  'commit-and-force-push',
  'delete-branch',
  'delete-remote-branch',
  'drop-stash',
  'discard-file',
  'discard-all',
  'discard-patch',
  'restore-file',
  'worktree-remove',
  'lfs-prune',
])

export function isDestructiveAction(kind: GitActionKind | string): boolean {
  return DESTRUCTIVE.has(kind as GitActionKind)
}
