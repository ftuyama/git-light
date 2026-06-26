import { describe, expect, it } from 'vitest'
import { computeGraphLayout } from './computeGraphLayout'
import { remapHeadLaneToLeft } from './remapHeadLaneLeft'
import type { Commit } from '@/types/git'

function makeCommit(sha: string, parents: string[], refs: Commit['refs'] = []): Commit {
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

describe('remapHeadLaneToLeft', () => {
  it('moves HEAD lane to column 0', () => {
    const commits = [
      makeCommit('other-tip', ['z']),
      makeCommit('head', ['a'], [{ type: 'localBranch', name: 'main', label: 'main', isHead: true }]),
      makeCommit('a', []),
      makeCommit('z', []),
    ]
    const layout = remapHeadLaneToLeft(computeGraphLayout(commits), 1)
    expect(layout.nodes.find((node) => node.sha === 'head')!.lane).toBe(0)
  })

  it('leaves layout unchanged when HEAD is already in lane 0', () => {
    const commits = [makeCommit('head', ['a'], [{ type: 'localBranch', name: 'main', label: 'main', isHead: true }]), makeCommit('a', [])]
    const base = computeGraphLayout(commits)
    const layout = remapHeadLaneToLeft(base, 0)
    expect(layout).toEqual(base)
  })
})
