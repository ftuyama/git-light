import { describe, expect, it } from 'vitest'
import { computeGraphLayout } from './computeGraphLayout'
import { findLaneBranchPreview } from './commitLaneBranchPreview'
import type { Branch, Commit, Ref } from '@/types/git'

function makeCommit(sha: string, parents: string[], refs: Ref[] = []): Commit {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    parents,
    subject: sha,
    author: {
      name: 'Test',
      email: 't@e.st',
      avatarUrl: '',
      initials: 'TT',
      color: '#fff',
    },
    committer: {
      name: 'Test',
      email: 't@e.st',
      avatarUrl: '',
      initials: 'TT',
      color: '#fff',
    },
    date: new Date(0),
    refs,
    isMerge: parents.length > 1,
  }
}

function branchRef(name: string, type: 'localBranch' | 'remoteBranch' = 'localBranch', isHead = false): Ref {
  return {
    type,
    name: type === 'localBranch' ? `refs/heads/${name}` : `refs/remotes/origin/${name}`,
    label: name,
    isHead,
  }
}

function makeBranch(
  name: string,
  tipSha: string,
  opts: Partial<Branch> = {},
): Branch {
  return {
    id: `local:${name}`,
    name,
    kind: 'local',
    group: '',
    tipSha,
    ahead: 0,
    behind: 0,
    isCurrent: false,
    isFavorite: false,
    lastActivity: new Date(0),
    laneColorIndex: 0,
    ...opts,
  }
}

describe('findLaneBranchPreview', () => {
  it('previews branch ref from HEAD tip on the same lane for linear history', () => {
    const commits = [
      makeCommit('c', ['b'], [branchRef('main', 'localBranch', true)]),
      makeCommit('b', ['a']),
      makeCommit('a', []),
    ]
    const layout = computeGraphLayout(commits)
    const preview = findLaneBranchPreview(2, commits, layout)
    expect(preview?.ref.label).toBe('main')
    expect(preview?.hasLocal).toBe(true)
    expect(preview?.ref.isHead).toBe(false)
  })

  it('previews side-lane branch for commits newer than the decorated tip on that lane', () => {
    const commits = [
      makeCommit('m', ['d', 'f2']),
      makeCommit('d', ['a'], [branchRef('main', 'localBranch', true)]),
      makeCommit('f2', ['f']),
      makeCommit('f', ['a'], [branchRef('feature', 'localBranch')]),
      makeCommit('a', []),
    ]
    const layout = computeGraphLayout(commits)
    const f2Index = commits.findIndex((c) => c.sha === 'f2')
    const preview = findLaneBranchPreview(f2Index, commits, layout)
    expect(preview?.ref.label).toBe('feature')
  })

  it('after merge convergence on lane 0, previews main-line branch not merged feature', () => {
    const commits = [
      makeCommit('m', ['d', 'f']),
      makeCommit('d', ['a'], [branchRef('main', 'localBranch', true)]),
      makeCommit('f', ['a'], [branchRef('feature', 'localBranch')]),
      makeCommit('a', []),
    ]
    const layout = computeGraphLayout(commits)
    const aIndex = commits.findIndex((c) => c.sha === 'a')
    expect(layout.nodes[aIndex]!.lane).toBe(0)
    const preview = findLaneBranchPreview(aIndex, commits, layout)
    expect(preview?.ref.label).toBe('main')
  })

  it('returns null when no branch matches the lane', () => {
    const commits = [makeCommit('a', [])]
    const layout = computeGraphLayout(commits)
    expect(findLaneBranchPreview(0, commits, layout)).toBeNull()
  })

  it('falls back to branch tipSha on the same lane when walk finds no decorations', () => {
    const commits = [
      makeCommit('c', ['b']),
      makeCommit('b', ['a']),
      makeCommit('a', []),
    ]
    const layout = computeGraphLayout(commits)
    const branches = [makeBranch('main', 'c', { isCurrent: true })]
    const preview = findLaneBranchPreview(2, commits, layout, branches)
    expect(preview?.ref.label).toBe('main')
    expect(preview?.hasLocal).toBe(true)
  })

  it('prefers current branch in fallback over other branches on the same lane', () => {
    const commits = [
      makeCommit('tip', ['a']),
      makeCommit('a', []),
    ]
    const layout = computeGraphLayout(commits)
    const branches = [
      makeBranch('develop', 'tip'),
      makeBranch('main', 'tip', { isCurrent: true }),
    ]
    const preview = findLaneBranchPreview(1, commits, layout, branches)
    expect(preview?.ref.label).toBe('main')
  })
})
