import { describe, expect, it } from 'vitest'
import {
  compareSemver,
  formatCurrentVersionMessage,
  formatReleaseNotes,
  formatUpdateAvailableDetail,
  pickMacDmgDownloadUrl,
  RELEASES_LATEST_API_URL,
  resolveDownloadUrl,
  shouldSkipStartupUpdatePrompt,
} from './updateCheck'

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

describe('pickMacDmgDownloadUrl', () => {
  const assets = [
    {
      name: 'Git Light-0.1.6-arm64.dmg',
      browser_download_url: 'https://github.com/example/arm64.dmg',
    },
    {
      name: 'Git Light-0.1.6-x64.dmg',
      browser_download_url: 'https://github.com/example/x64.dmg',
    },
  ]

  it('prefers the arm64 dmg on Apple silicon', () => {
    expect(pickMacDmgDownloadUrl(assets, 'arm64')).toBe('https://github.com/example/arm64.dmg')
  })

  it('prefers the x64 dmg on Intel Macs', () => {
    expect(pickMacDmgDownloadUrl(assets, 'x64')).toBe('https://github.com/example/x64.dmg')
  })

  it('returns null when no dmg asset exists', () => {
    expect(pickMacDmgDownloadUrl([{ name: 'notes.txt', browser_download_url: 'https://x' }])).toBeNull()
  })
})

describe('resolveDownloadUrl', () => {
  it('uses the dmg asset on macOS when available', () => {
    expect(
      resolveDownloadUrl(
        {
          tag_name: 'v0.1.6',
          html_url: 'https://github.com/ftuyama/git-light/releases/tag/v0.1.6',
          assets: [
            {
              name: 'Git Light-0.1.6-arm64.dmg',
              browser_download_url:
                'https://github.com/ftuyama/git-light/releases/download/v0.1.6/Git%20Light-0.1.6-arm64.dmg',
            },
          ],
        },
        'darwin',
        'arm64',
      ),
    ).toBe(
      'https://github.com/ftuyama/git-light/releases/download/v0.1.6/Git%20Light-0.1.6-arm64.dmg',
    )
  })

  it('falls back to the release page when no dmg is attached', () => {
    const htmlUrl = 'https://github.com/ftuyama/git-light/releases/tag/v0.1.6'
    expect(
      resolveDownloadUrl(
        {
          tag_name: 'v0.1.6',
          html_url: htmlUrl,
          assets: [],
        },
        'darwin',
      ),
    ).toBe(htmlUrl)
  })
})

describe('formatReleaseNotes', () => {
  it('strips common markdown formatting', () => {
    expect(
      formatReleaseNotes('## Fixes\n\n- **Graph**: smoother lanes\n- [Docs](https://example.com) updated'),
    ).toBe('Fixes\n\n• Graph: smoother lanes\n• Docs updated')
  })

  it('returns an empty string for blank notes', () => {
    expect(formatReleaseNotes('   ')).toBe('')
    expect(formatReleaseNotes(null)).toBe('')
  })

  it('truncates very long notes', () => {
    const longBody = `## Changes\n\n${'A'.repeat(900)}`
    expect(formatReleaseNotes(longBody)).toHaveLength(800)
    expect(formatReleaseNotes(longBody).endsWith('…')).toBe(true)
  })
})

describe('formatUpdateAvailableDetail', () => {
  it('includes release notes when present', () => {
    expect(
      formatUpdateAvailableDetail({
        currentVersion: '0.1.5',
        releaseNotes: '• Faster graph layout',
      }),
    ).toBe(
      "You are running v0.1.5.\n\nWhat's new:\n• Faster graph layout\n\nDownload starts the installer from GitHub.",
    )
  })

  it('omits the notes section when release notes are empty', () => {
    expect(
      formatUpdateAvailableDetail({
        currentVersion: '0.1.5',
        releaseNotes: '',
      }),
    ).toBe('You are running v0.1.5.\n\nDownload starts the installer from GitHub.')
  })
})

describe('shouldSkipStartupUpdatePrompt', () => {
  it('skips when the snoozed version matches the latest release', () => {
    expect(shouldSkipStartupUpdatePrompt('0.1.7', { version: '0.1.7' })).toBe(true)
  })

  it('does not skip for a newer release or when nothing was snoozed', () => {
    expect(shouldSkipStartupUpdatePrompt('0.1.8', { version: '0.1.7' })).toBe(false)
    expect(shouldSkipStartupUpdatePrompt('0.1.7', null)).toBe(false)
  })
})
