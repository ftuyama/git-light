import { describe, expect, it } from 'vitest'
import { compareSemver } from './updateCheck'

describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0)
    expect(compareSemver('v1.2.3', '1.2.3')).toBe(0)
  })

  it('returns positive when first version is newer', () => {
    expect(compareSemver('1.3.0', '1.2.9')).toBeGreaterThan(0)
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0)
  })

  it('returns negative when first version is older', () => {
    expect(compareSemver('1.2.0', '1.2.1')).toBeLessThan(0)
  })

  it('returns null for invalid versions', () => {
    expect(compareSemver('latest', '1.0.0')).toBeNull()
    expect(compareSemver('1.0', '1.0.0')).toBeNull()
  })
})
