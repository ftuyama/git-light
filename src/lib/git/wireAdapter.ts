import type {
  CommitPageInfo,
  WireAuthor,
  WireBranch,
  WireCommit,
  WireRef,
  WireRepository,
  WireRepositorySnapshot,
  WireStash,
  WireTag,
  WireWorkingTreeFile,
  WireWorktree,
} from '@shared/git/models'
import { isHeadBranch, isHeadSymbolicRef } from './headRef'
import type {
  Author,
  Branch,
  Commit,
  Ref,
  Repository,
  RepositoryData,
  Stash,
  Tag,
  WorkingTreeFile,
  Worktree,
} from '@/types/git'

function reviveAuthor(w: WireAuthor): Author {
  return { ...w }
}

function reviveRef(w: WireRef): Ref {
  return { ...w }
}

function reviveDate(value: string): Date {
  const date = new Date(value)
  // A malformed wire date must not propagate as `Invalid Date` into
  // relative-time formatting — fall back to epoch instead.
  return Number.isNaN(date.getTime()) ? new Date(0) : date
}

function reviveCommit(w: WireCommit): Commit {
  return {
    ...w,
    author: reviveAuthor(w.author),
    committer: reviveAuthor(w.committer),
    date: reviveDate(w.date),
    refs: w.refs.filter((r) => !isHeadSymbolicRef(r)).map(reviveRef),
  }
}

function reviveBranch(w: WireBranch): Branch {
  return { ...w, lastActivity: reviveDate(w.lastActivity) }
}

function reviveTag(w: WireTag): Tag {
  return { ...w, date: reviveDate(w.date) }
}

function reviveStash(w: WireStash): Stash {
  return { ...w, date: reviveDate(w.date) }
}

function reviveWorktree(w: WireWorktree): Worktree {
  return { ...w }
}

function reviveFile(w: WireWorkingTreeFile): WorkingTreeFile {
  return { ...w }
}

export function reviveWorkingTreeFile(w: WireWorkingTreeFile): WorkingTreeFile {
  return reviveFile(w)
}

function reviveRepository(w: WireRepository): Repository {
  return {
    name: w.name,
    path: w.path,
    gitVersion: w.gitVersion,
    currentBranch: w.currentBranch,
    ahead: w.ahead,
    behind: w.behind,
    remoteUrl: w.remoteUrl,
    detached: w.detached,
    headSha: w.headSha,
    remotes: w.remotes,
    state: w.state,
    canUndo: w.canUndo,
    canRedo: w.canRedo,
    undoLabel: w.undoLabel,
    redoLabel: w.redoLabel,
  }
}

export function wireSnapshotToRepositoryData(
  snapshot: WireRepositorySnapshot,
): RepositoryData & { page: CommitPageInfo } {
  return {
    repository: reviveRepository(snapshot.repository),
    commits: snapshot.commits.map(reviveCommit),
    branches: snapshot.branches.filter((b) => !isHeadBranch(b)).map(reviveBranch),
    tags: snapshot.tags.map(reviveTag),
    stashes: snapshot.stashes.map(reviveStash),
    worktrees: snapshot.worktrees.map(reviveWorktree),
    workingTree: snapshot.workingTree.map(reviveFile),
    authors: snapshot.authors.map(reviveAuthor),
    commitAuthor: reviveAuthor(snapshot.commitAuthor),
    page: snapshot.page,
  }
}

export function reviveCommits(wire: WireCommit[]): Commit[] {
  return wire.map(reviveCommit)
}
