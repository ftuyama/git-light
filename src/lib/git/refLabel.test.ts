import { describe, expect, it } from 'vitest'
import { formatRefLabel } from '@shared/git/refLabel'

describe('formatRefLabel', () => {
  it('strips refs/heads/', () => {
    expect(formatRefLabel('refs/heads/main', 'localBranch')).toBe('main')
    expect(formatRefLabel('refs/heads/feature/payment', 'localBranch')).toBe('feature/payment')
  })

  it('strips refs/remotes/<remote>/', () => {
    expect(formatRefLabel('refs/remotes/origin/main', 'remoteBranch')).toBe('main')
    expect(formatRefLabel('refs/remotes/origin/feature/payment', 'remoteBranch')).toBe(
      'feature/payment',
    )
  })

  it('strips remote prefix from origin/ style names', () => {
    expect(formatRefLabel('origin/main', 'remoteBranch')).toBe('main')
    expect(formatRefLabel('origin/feature/payment', 'remoteBranch')).toBe('feature/payment')
  })

  it('leaves local branch names unchanged', () => {
    expect(formatRefLabel('feature/payment', 'localBranch')).toBe('feature/payment')
    expect(formatRefLabel('main', 'localBranch')).toBe('main')
  })

  it('strips refs/tags/', () => {
    expect(formatRefLabel('refs/tags/v1.0.0', 'tag')).toBe('v1.0.0')
  })
})
