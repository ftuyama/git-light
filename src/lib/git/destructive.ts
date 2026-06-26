import type { GitActionKind } from '@/types/git'

const DESTRUCTIVE = new Set<GitActionKind>([
  'reset-hard',
  'force-push',
  'commit-and-force-push',
  'delete-branch',
  'delete-remote-branch',
  'drop-stash',
  'discard-file',
  'discard-all',
])

export function isDestructiveAction(kind: GitActionKind): boolean {
  return DESTRUCTIVE.has(kind)
}
