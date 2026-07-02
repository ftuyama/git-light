import { describe, expect, it } from 'vitest'
import { branchFromRef, findBranchForRef, remoteRefKey } from './branchRefUtils'
import type { Branch, Ref } from '@/types/git'

const branches: Branch[] = [
  {
    id: 'local:main',
    name: 'main',
    kind: 'local',
    group: '',
    tipSha: 'abc',
    ahead: 0,
    behind: 0,
    isCurrent: true,
    isFavorite: false,
    lastActivity: new Date(0),
    laneColorIndex: 0,
  },
  {
    id: 'remote:origin/feature',
    name: 'feature',
    kind: 'remote',
    group: 'feature',
    remote: 'origin',
    tipSha: 'def',
    ahead: 0,
    behind: 0,
    isCurrent: false,
    isFavorite: false,
    lastActivity: new Date(0),
    laneColorIndex: 1,
  },
]

describe('remoteRefKey', () => {
  it('strips refs/remotes prefix', () => {
    expect(remoteRefKey('refs/remotes/origin/main')).toBe('origin/main')
  })

  it('passes through short remote names', () => {
    expect(remoteRefKey('origin/main')).toBe('origin/main')
  })
})

describe('findBranchForRef', () => {
  it('matches local branches by short name', () => {
    const ref: Ref = {
      type: 'localBranch',
      name: 'refs/heads/main',
      label: 'main',
      isHead: true,
    }
    expect(findBranchForRef(ref, branches)?.id).toBe('local:main')
  })

  it('matches remote branches by remote/name key', () => {
    const ref: Ref = {
      type: 'remoteBranch',
      name: 'refs/remotes/origin/feature',
      label: 'feature',
    }
    expect(findBranchForRef(ref, branches)?.id).toBe('remote:origin/feature')
  })
})

describe('branchFromRef', () => {
  it('synthesizes a local branch when missing from the sidebar list', () => {
    const ref: Ref = {
      type: 'localBranch',
      name: 'refs/heads/experimental',
      label: 'experimental',
    }
    const branch = branchFromRef(ref, branches)
    expect(branch?.name).toBe('experimental')
    expect(branch?.kind).toBe('local')
  })
})
