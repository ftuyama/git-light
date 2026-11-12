import { describe, expect, it } from 'vitest'
import { computeGraphLayout, extendGraphLayout } from './computeGraphLayout'
import { laneColor } from '@/lib/utils'
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
    // The fan-out edge itself reaches the branch lane; no duplicate straight.
    expect(mergeBand.filter((edge) => edge.toLane === 1)).toHaveLength(1)
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

  it('colors the branch convergence with the branch lane, not the main lane', () => {
    // main: m2 <- m1; test branched off m1 with t2 <- t1.
    const commits = [
      makeCommit('m2', ['m1']),
      makeCommit('t2', ['t1']),
      makeCommit('t1', ['m1']),
      makeCommit('m1', []),
    ]
    const layout = computeGraphLayout(commits)
    expect(layout.nodes.map((node) => node.lane)).toEqual([0, 1, 1, 0])

    const branchLane = layout.nodes[1].lane
    const converge = layout.bands[2].find((edge) => edge.kind === 'converge')
    expect(converge).toBeDefined()
    expect(converge!.fromLane).toBe(branchLane)
    expect(converge!.toLane).toBe(0)
    expect(converge!.color).toBe(laneColor(branchLane))
    expect(converge!.color).not.toBe(laneColor(0))
  })

  it('keeps a converging branch in its lane until its fork row', () => {
    // main branched off base one commit ago; the other branch still has four
    // commits between its tip and base.
    const commits = [
      makeCommit('other2', ['other1']),
      makeCommit('main2', ['base']),
      makeCommit('other1', ['base']),
      makeCommit('base', []),
      makeCommit('root', []),
    ]
    const layout = computeGraphLayout(commits)
    expect(layout.nodes.map((node) => node.lane)).toEqual([0, 1, 0, 0, 0])

    // Row 1 (main2) must not drop into lane 0 right below itself.
    expect(layout.bands[1].some((edge) => edge.fromLane === 1 && edge.toLane === 0)).toBe(false)

    // The branch descends in its own lane through the other branch's commits.
    expect(
      layout.bands[1].some(
        (edge) => edge.fromLane === 1 && edge.toLane === 1 && edge.kind === 'straight',
      ),
    ).toBe(true)
    expect(layout.bands[1].some((edge) => edge.fromLane === 0 && edge.toLane === 0)).toBe(true)

    // It joins the shared base lane only in the band right above the fork row.
    const convergeBands = layout.bands.flatMap((band, index) =>
      band.filter((edge) => edge.kind === 'converge').map(() => index),
    )
    expect(convergeBands).toEqual([2])
  })

  it('keeps the merged branch color on a merge fan-out', () => {
    const commits = [
      makeCommit('m', ['d', 'f']),
      makeCommit('d', ['a']),
      makeCommit('f', ['a']),
      makeCommit('a', []),
    ]
    const layout = computeGraphLayout(commits)
    const mergeFork = layout.bands[0].find((edge) => edge.kind === 'merge')!
    expect(mergeFork.color).toBe(laneColor(mergeFork.toLane))
    // The merge edge already descends into the branch lane: a second straight
    // edge in the same band would leave a stray cap beside the corner radius.
    expect(
      layout.bands[0].some(
        (edge) =>
          edge.kind === 'straight' &&
          edge.fromLane === mergeFork.toLane &&
          edge.toLane === mergeFork.toLane,
      ),
    ).toBe(false)
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

  it('extendGraphLayout keeps the HEAD lane straight across pages', () => {
    const firstPage = [
      makeCommit('other-tip', ['other-1']),
      makeCommit('head-tip', ['base']),
    ]
    const secondPage = [
      makeCommit('other-1', ['base']),
      makeCommit('base', ['root']),
      makeCommit('root', []),
    ]
    const headIndex = 1
    const partial = computeGraphLayout(firstPage, headIndex)
    const extended = extendGraphLayout(firstPage, secondPage, partial, headIndex)
    const full = computeGraphLayout([...firstPage, ...secondPage], headIndex)
    expect(extended.nodes.map((n) => n.lane)).toEqual(full.nodes.map((n) => n.lane))
    expect(extended.nodes.map((n) => `${n.sha}@${n.lane}`)).toEqual([
      'other-tip@0',
      'head-tip@1',
      'other-1@0',
      'base@1',
      'root@1',
    ])
  })

  it('extendGraphLayout matches full layout when appending older commits', () => {
    const firstPage = [
      makeCommit('m', ['d', 'f']),
      makeCommit('d', ['a']),
    ]
    const secondPage = [makeCommit('f', ['a']), makeCommit('a', [])]
    const partial = computeGraphLayout(firstPage)
    const extended = extendGraphLayout(firstPage, secondPage, partial)
    const full = computeGraphLayout([...firstPage, ...secondPage])
    expect(extended.nodes.map((n) => n.lane)).toEqual(full.nodes.map((n) => n.lane))
    expect(extended.maxLanes).toBe(full.maxLanes)
    expect(extended.bands.length).toBe(full.bands.length)
  })
})
