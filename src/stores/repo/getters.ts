import { headCommitIndex as computeHeadCommitIndex } from '@/lib/graph/pendingGraphRow'
import { isHeadBranch } from '@/lib/git/headRef'
import type { Branch, Commit } from '@/types/git'
import type { RepositoryState } from './types'

export const repositoryGetters = {
  localBranches: (state: RepositoryState): Branch[] =>
    state.branches.filter((b) => b.kind === 'local' && !isHeadBranch(b)),
  remoteBranches: (state: RepositoryState): Branch[] =>
    state.branches.filter((b) => b.kind === 'remote' && !isHeadBranch(b)),
  favoriteBranches: (state: RepositoryState): Branch[] =>
    state.branches.filter((b) => b.isFavorite && !isHeadBranch(b)),
  currentBranch: (state: RepositoryState): Branch | undefined => state.branches.find((b) => b.isCurrent),
  stagedFiles: (state: RepositoryState) => state.workingTree.filter((f) => f.staged),
  unstagedFiles: (state: RepositoryState) =>
    state.workingTree.filter((f) => !f.staged && f.status !== 'conflicted'),
  conflictedFiles: (state: RepositoryState) =>
    state.workingTree.filter((f) => f.status === 'conflicted'),
  hasPendingChanges(): boolean {
    return (
      this.unstagedFiles.length > 0 ||
      this.stagedFiles.length > 0 ||
      this.conflictedFiles.length > 0
    )
  },
  headCommitIndex(state: RepositoryState): number {
    return computeHeadCommitIndex(state.commits, state.repository?.headSha)
  },
  headCommit(state: RepositoryState): Commit | undefined {
    const headSha = state.repository?.headSha
    if (headSha) {
      const bySha = state.commits.find((c) => c.sha === headSha)
      if (bySha) return bySha
    }
    return state.commits.find((c) => c.refs.some((r) => r.isHead))
  },
  canAmend(): boolean {
    return this.headCommit != null
  },
  hasUnresolvedConflicts(): boolean {
    return this.conflictedFiles.length > 0
  },
  canCommit(state: RepositoryState): boolean {
    const hasMessage = state.commitMessage.trim().length > 0
    if (state.amend) {
      if (!this.headCommit) return false
      return hasMessage || this.stagedFiles.length > 0
    }
    return hasMessage && this.stagedFiles.length > 0
  },
  hasOpenRepo: (state: RepositoryState): boolean => state.repository != null,
  repoState: (state: RepositoryState) => state.repository?.state,
  inProgressOperation(state: RepositoryState): boolean {
    const s = state.repository?.state
    if (!s) return false
    return s.merging || s.rebasing || s.cherryPicking || s.reverting || s.bisecting
  },
  canUndo(state: RepositoryState): boolean {
    return !!(
      state.repository?.canUndo &&
      !state.busyAction &&
      !state.refreshing &&
      !this.inProgressOperation
    )
  },
  canRedo(state: RepositoryState): boolean {
    return !!(
      state.repository?.canRedo &&
      !state.busyAction &&
      !state.refreshing &&
      !this.inProgressOperation
    )
  },
  undoTooltip(state: RepositoryState): string {
    const label = state.repository?.undoLabel
    return label ? `Undo ${label}` : 'Undo'
  },
  redoTooltip(state: RepositoryState): string {
    const label = state.repository?.redoLabel
    return label ? `Redo ${label}` : 'Redo'
  },
}
