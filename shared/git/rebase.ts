/** Actions supported in an interactive rebase todo list. */
export type RebaseTodoAction = 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop'

export interface RebaseCommitEntry {
  sha: string
  shortSha: string
  subject: string
  authorName: string
  /** ISO-8601 date string. */
  date: string
}

export interface RebaseCommitsRequest {
  /** Upstream ref — commits after this ref up to HEAD are included. */
  base: string
}

export interface RebaseCommitsResult {
  base: string
  baseShortSha: string
  commits: RebaseCommitEntry[]
}

/** One line in the interactive rebase plan sent to the main process. */
export interface RebaseTodoLine {
  sha: string
  subject: string
  action: RebaseTodoAction
  /** Replacement commit message when action is `reword`. */
  message?: string
}

export const REBASE_ACTION_LABELS: Record<RebaseTodoAction, string> = {
  pick: 'Pick',
  reword: 'Reword',
  edit: 'Edit',
  squash: 'Squash',
  fixup: 'Fixup',
  drop: 'Drop',
}
