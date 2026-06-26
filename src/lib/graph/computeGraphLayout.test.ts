import { describe, expect, it } from 'vitest'
import { computeGraphLayout } from './computeGraphLayout'
import type { Commit } from '@/types/git'

function makeCommit(sha: string, parents: string[]): Commit {
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
    refs: [],
    isMerge: parents.length > 1,
  }
}

describe('computeGraphLayout', () => {
  it('keeps a linear history in a single lane', () => {
    const commits = [
      makeCommit('c', ['b']),
      makeCommit('b', ['a']),
      makeCommit('a', []),
    ]
    const layout = computeGraphLayout(commits)
    expect(layout.maxLanes).toBe(1)
    expect(layout.nodes.map((node) => node.lane)).toEqual([0, 0, 0])
  })

  it('assigns a second lane for a branch and merge', () => {
    // m merges feature(f) into main; f branched from a.
    const commits = [
      makeCommit('m', ['d', 'f']),
      makeCommit('d', ['a']),
      makeCommit('f', ['a']),
      makeCommit('a', []),
    ]
    const layout = computeGraphLayout(commits)
    expect(layout.maxLanes).toBeGreaterThanOrEqual(2)
    // The merge commit claims lane 0, its merge parent reserves another lane.
    expect(layout.nodes[0].lane).toBe(0)
    expect(layout.nodes.find((node) => node.sha === 'f')!.lane).toBeGreaterThan(0)
  })

  it('produces a fan-out edge from a merge commit to its second parent', () => {
    const commits = [
      makeCommit('m', ['d', 'f']),
      makeCommit('d', ['a']),
      makeCommit('f', ['a']),
      makeCommit('a', []),
    ]
    const layout = computeGraphLayout(commits)
    const mergeBand = layout.bands[0]
    const diagonal = mergeBand.find((edge) => edge.fromLane !== edge.toLane)
    expect(diagonal).toBeDefined()
  })

  it('tags only merge fan-outs with a merge edge kind', () => {
    const commits = [
      makeCommit('m', ['d', 'f']),
      makeCommit('d', ['a']),
      makeCommit('f', ['a']),
      makeCommit('a', []),
    ]
    const layout = computeGraphLayout(commits)
    const mergeBand = layout.bands[0]
    const mergeFork = mergeBand.find((edge) => edge.fromLane !== edge.toLane)
    expect(mergeFork?.kind).toBe('merge')
    expect(mergeBand.some((edge) => edge.fromLane === 1 && edge.toLane === 1)).toBe(true)
  })

  it('frees a lane after a branch converges on the main line', () => {
    const commits = [
      makeCommit('m', ['d', 'f']),
      makeCommit('d', ['a']),
      makeCommit('f', ['a']),
      makeCommit('a', []),
    ]
    const layout = computeGraphLayout(commits)
    expect(layout.nodes.find((node) => node.sha === 'a')!.lane).toBe(0)
  })

  it('handles an octopus merge with three parents', () => {
    const commits = [
      makeCommit('m', ['a', 'b', 'c']),
      makeCommit('a', ['z']),
      makeCommit('b', ['z']),
      makeCommit('c', ['z']),
      makeCommit('z', []),
    ]
    const layout = computeGraphLayout(commits)
    expect(layout.maxLanes).toBeGreaterThanOrEqual(3)
  })

  it('ignores parents outside the commit set', () => {
    const commits = [makeCommit('c', ['missing'])]
    const layout = computeGraphLayout(commits)
    expect(layout.nodes).toHaveLength(1)
    expect(layout.bands[0]).toHaveLength(0)
  })
})
