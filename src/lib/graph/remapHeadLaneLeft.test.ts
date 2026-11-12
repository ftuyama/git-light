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

  it('keeps the HEAD branch straight and bends the other branch into it', () => {
    const commits = [
      makeCommit('other-tip', ['other-1']),
      makeCommit('head-tip', ['base'], [
        { type: 'localBranch', name: 'main', label: 'main', isHead: true },
      ]),
      makeCommit('other-1', ['base']),
      makeCommit('base', ['root']),
      makeCommit('root', []),
    ]
    const layout = remapHeadLaneToLeft(computeGraphLayout(commits, 1), 1)

    expect(layout.nodes.map((node) => `${node.sha}@${node.lane}`)).toEqual([
      'other-tip@1',
      'head-tip@0',
      'other-1@1',
      'base@0',
      'root@0',
    ])

    // HEAD's line runs straight down its own lane through the fork.
    expect(
      layout.bands[1].some(
        (edge) => edge.fromLane === 0 && edge.toLane === 0 && edge.kind === 'straight',
      ),
    ).toBe(true)
    expect(
      layout.bands[2].some(
        (edge) => edge.fromLane === 0 && edge.toLane === 0 && edge.kind === 'straight',
      ),
    ).toBe(true)

    // The other branch curves into HEAD's lane where both share a parent.
    const converge = layout.bands[2].find((edge) => edge.kind === 'converge')
    expect(converge).toMatchObject({ fromLane: 1, toLane: 0 })
  })

  it('leaves layout unchanged when HEAD is already in lane 0', () => {
    const commits = [makeCommit('head', ['a'], [{ type: 'localBranch', name: 'main', label: 'main', isHead: true }]), makeCommit('a', [])]
    const base = computeGraphLayout(commits)
    const layout = remapHeadLaneToLeft(base, 0)
    expect(layout).toEqual(base)
  })
})
