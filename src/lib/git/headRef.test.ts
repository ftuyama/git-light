import { describe, expect, it } from 'vitest'
import { isHeadBranch, isHeadSymbolicRef } from './headRef'

describe('headRef', () => {
  it('flags HEAD pseudo-refs and symbolic origin/HEAD refs', () => {
    expect(isHeadSymbolicRef({ type: 'head', name: 'HEAD', label: 'HEAD' })).toBe(true)
    expect(isHeadSymbolicRef({ type: 'remoteBranch', name: 'origin/HEAD', label: 'HEAD' })).toBe(true)
    expect(
      isHeadSymbolicRef({
        type: 'remoteBranch',
        name: 'refs/remotes/origin/HEAD',
        label: 'HEAD',
      }),
    ).toBe(true)
  })

  it('keeps real branches visible', () => {
    expect(isHeadSymbolicRef({ type: 'localBranch', name: 'main', label: 'main' })).toBe(false)
    expect(
      isHeadSymbolicRef({ type: 'remoteBranch', name: 'origin/main', label: 'main' }),
    ).toBe(false)
  })

  it('flags HEAD branches', () => {
    expect(isHeadBranch({ name: 'HEAD' })).toBe(true)
    expect(isHeadBranch({ name: 'main' })).toBe(false)
  })
})
