import { describe, expect, it } from 'vitest'
import { isDestructiveAction } from './destructive'

describe('isDestructiveAction', () => {
  it('marks force push as destructive', () => {
    expect(isDestructiveAction('force-push')).toBe(true)
  })

  it('does not mark fetch as destructive', () => {
    expect(isDestructiveAction('fetch')).toBe(false)
  })
})
