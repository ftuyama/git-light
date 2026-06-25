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

function reviveCommit(w: WireCommit): Commit {
  return {
    ...w,
    author: reviveAuthor(w.author),
    committer: reviveAuthor(w.committer),
    date: new Date(w.date),
    refs: w.refs.map(reviveRef),
  }
}

function reviveBranch(w: WireBranch): Branch {
  return { ...w, lastActivity: new Date(w.lastActivity) }
}

function reviveTag(w: WireTag): Tag {
  return { ...w, date: new Date(w.date) }
}

function reviveStash(w: WireStash): Stash {
  return { ...w, date: new Date(w.date) }
}

function reviveWorktree(w: WireWorktree): Worktree {
  return { ...w }
}

function reviveFile(w: WireWorkingTreeFile): WorkingTreeFile {
  return { ...w }
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
  }
}

export function wireSnapshotToRepositoryData(
  snapshot: WireRepositorySnapshot,
): RepositoryData & { page: CommitPageInfo } {
  return {
    repository: reviveRepository(snapshot.repository),
    commits: snapshot.commits.map(reviveCommit),
    branches: snapshot.branches.map(reviveBranch),
    tags: snapshot.tags.map(reviveTag),
    stashes: snapshot.stashes.map(reviveStash),
    worktrees: snapshot.worktrees.map(reviveWorktree),
    workingTree: snapshot.workingTree.map(reviveFile),
    authors: snapshot.authors.map(reviveAuthor),
    page: snapshot.page,
  }
}

export function reviveCommits(wire: WireCommit[]): Commit[] {
  return wire.map(reviveCommit)
}
