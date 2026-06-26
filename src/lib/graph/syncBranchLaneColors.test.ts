import { describe, expect, it } from 'vitest'
import { computeGraphLayout } from './computeGraphLayout'
import { remapHeadLaneToLeft } from './remapHeadLaneLeft'
import { laneIndexForBranchTip, syncBranchLaneColors } from './syncBranchLaneColors'
import type { Branch, Commit } from '@/types/git'

function makeCommit(sha: string, parents: string[] = []): Commit {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    parents,
    subject: sha,
    author: { name: 'a', email: 'a@b.c', avatarUrl: '', initials: 'A', color: '#000' },
    committer: { name: 'a', email: 'a@b.c', avatarUrl: '', initials: 'A', color: '#000' },
    date: new Date(),
    refs: [],
    isMerge: parents.length > 1,
  }
}

function makeBranch(name: string, tipSha: string, laneColorIndex = 3): Branch {
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
    lastActivity: new Date(),
    laneColorIndex,
  }
}

describe('syncBranchLaneColors', () => {
  it('maps branch laneColorIndex to the graph lane at its tip commit', () => {
    const commits = [
      makeCommit('c3', ['c2']),
      makeCommit('c2', ['c1']),
      makeCommit('c1', []),
    ]
    const layout = remapHeadLaneToLeft(computeGraphLayout(commits), 0)
    const branches = [makeBranch('feature', 'c2', 7)]

    const synced = syncBranchLaneColors(branches, commits, layout)
    const tipLane = layout.nodes[1]!.lane

    expect(laneIndexForBranchTip(branches[0]!, commits, layout)).toBe(tipLane)
    expect(synced[0]!.laneColorIndex).toBe(tipLane)
    expect(synced[0]!.laneColorIndex).not.toBe(7)
  })

  it('keeps the parser fallback when the tip is outside the loaded commit window', () => {
    const commits = [makeCommit('c1', [])]
    const layout = computeGraphLayout(commits)
    const branches = [makeBranch('feature', 'missing-tip', 5)]

    const synced = syncBranchLaneColors(branches, commits, layout)

    expect(synced[0]!.laneColorIndex).toBe(5)
  })
})
