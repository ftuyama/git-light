import { describe, expect, it } from 'vitest'
import { sortCurrentBranchFirst } from './sortBranches'
import type { Branch } from '@/types/git'

function branch(name: string, isCurrent = false): Branch {
  return {
    id: name,
    name,
    kind: 'local',
    group: '',
    tipSha: 'abc',
    ahead: 0,
    behind: 0,
    isCurrent,
    isFavorite: false,
    lastActivity: new Date(0),
    laneColorIndex: 0,
  }
}

describe('sortCurrentBranchFirst', () => {
  it('moves the current branch to the front', () => {
    const sorted = sortCurrentBranchFirst([
      branch('develop'),
      branch('main', true),
      branch('feature/x'),
    ])
    expect(sorted.map((b) => b.name)).toEqual(['main', 'develop', 'feature/x'])
  })

  it('leaves the list unchanged when current is already first', () => {
    const branches = [branch('main', true), branch('develop')]
    expect(sortCurrentBranchFirst(branches)).toEqual(branches)
  })
})
