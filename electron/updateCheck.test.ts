import { describe, expect, it } from 'vitest'
import { compareSemver, formatCurrentVersionMessage, RELEASES_LATEST_API_URL } from './updateCheck'

describe('RELEASES_LATEST_API_URL', () => {
  it('points at the GitHub REST API, not the web releases page', () => {
    expect(RELEASES_LATEST_API_URL).toBe(
      'https://api.github.com/repos/ftuyama/git-light/releases/latest',
    )
  })
})

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

  it('compares optional fourth version segments', () => {
    expect(compareSemver('0.1.3.2', '0.1.3')).toBeGreaterThan(0)
    expect(compareSemver('0.1.3', '0.1.3.1')).toBeLessThan(0)
  })

  it('returns null for invalid versions', () => {
    expect(compareSemver('latest', '1.0.0')).toBeNull()
    expect(compareSemver('1.0', '1.0.0')).toBeNull()
  })
})

describe('formatCurrentVersionMessage', () => {
  it('describes an up-to-date install', () => {
    expect(
      formatCurrentVersionMessage({
        comparison: 0,
        currentVersion: '0.1.3.2',
        latestVersion: '0.1.3.2',
      }),
    ).toEqual({
      message: "You're up to date (v0.1.3.2).",
      detail: 'This matches the latest release on GitHub.',
    })
  })

  it('describes a version ahead of the latest release', () => {
    expect(
      formatCurrentVersionMessage({
        comparison: -1,
        currentVersion: '0.2.0',
        latestVersion: '0.1.3.2',
      }),
    ).toEqual({
      message: "You're running a newer version (v0.2.0).",
      detail: 'The latest release on GitHub is v0.1.3.2.',
    })
  })
})
