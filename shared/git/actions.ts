/**
 * The full set of mutating/side-effecting operations the UI can request. The
 * renderer dispatches these as `GitAction`s; the main-process action router
 * maps each to concrete git commands. `meta` carries operation-specific
 * parameters (commit message, merge mode, etc.).
 */
export type GitActionKind =
  // Remote
  | 'fetch'
  | 'fetch-all'
  | 'pull'
  | 'push'
  | 'force-push'
  | 'push-tags'
  | 'prune'
  | 'sync'
  // Stash
  | 'stash'
  | 'pop-stash'
  | 'apply-stash'
  | 'drop-stash'
  | 'rename-stash'
  // History rewrite / integration
  | 'cherry-pick'
  | 'cherry-pick-continue'
  | 'cherry-pick-abort'
  | 'merge'
  | 'merge-continue'
  | 'merge-abort'
  | 'rebase'
  | 'interactive-rebase'
  | 'rebase-from-here'
  | 'rebase-continue'
  | 'rebase-abort'
  | 'rebase-skip'
  | 'reset-soft'
  | 'reset-mixed'
  | 'reset-hard'
  | 'revert'
  | 'revert-continue'
  | 'revert-abort'
  | 'undo'
  | 'redo'
  // Repository / misc
  | 'refresh'
  | 'open-terminal'
  | 'reveal-in-finder'
  | 'open-remote'
  | 'copy-sha'
  | 'open-on-github'
  // Branches
  | 'checkout'
  | 'checkout-commit'
  | 'create-branch'
  | 'delete-branch'
  | 'delete-remote-branch'
  | 'rename-branch'
  | 'set-upstream'
  | 'compare-branches'
  // Tags
  | 'tag'
  | 'create-tag'
  | 'delete-tag'
  | 'checkout-tag'
  // Working tree
  | 'stage'
  | 'unstage'
  | 'stage-all'
  | 'unstage-all'
  | 'discard-file'
  | 'discard-all'
  | 'stage-patch'
  | 'unstage-patch'
  // Merge conflicts
  | 'resolve-conflict-ours'
  | 'resolve-conflict-theirs'
  | 'resolve-conflict-block'
  | 'mark-conflict-resolved'
  // Commit
  | 'commit'
  | 'amend'
  | 'commit-and-push'
  | 'commit-and-force-push'

export interface GitAction {
  kind: GitActionKind
  /** Primary target: branch name, SHA, tag, file path, stash ref, etc. */
  target?: string
  meta?: Record<string, unknown>
}

export interface ActionResult {
  ok: boolean
  message: string
  errorCode?: import('./errors').GitErrorCode
}
