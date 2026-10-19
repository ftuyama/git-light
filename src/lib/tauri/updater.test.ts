import { describe, expect, it, vi } from 'vitest'
import {
  checkForUpdates,
  compareSemver,
  formatReleaseNotes,
  lookupChecksum,
  pickChecksumsUrl,
  pickLinuxInstallerUrl,
  pickMacDmgDownloadUrl,
  pickMacTarGzUrl,
  pickWindowsInstallerUrl,
  type GitHubAsset,
} from './updater'

const asset = (name: string): GitHubAsset => ({
  name,
  browser_download_url: `https://example.com/${name}`,
})

describe('tauri updater', () => {
  it('compares semver versions', () => {
    expect(compareSemver('0.3.0', '0.2.0')).toBeGreaterThan(0)
    expect(compareSemver('0.2.0', '0.2.0')).toBe(0)
    expect(compareSemver('0.1.9', '0.2.0')).toBeLessThan(0)
    expect(compareSemver('v1.2.3', '1.2.3')).toBe(0)
    expect(compareSemver('nope', '0.2.0')).toBeNull()
  })

  it('prefers an arch-matching dmg', () => {
    const assets = [
      { name: 'Git-Light_0.3.0_x64.dmg', browser_download_url: 'https://x64' },
      { name: 'Git-Light_0.3.0_arm64.dmg', browser_download_url: 'https://arm64' },
    ]
    expect(pickMacDmgDownloadUrl(assets, 'arm64')).toBe('https://arm64')
    expect(pickMacDmgDownloadUrl(assets, 'x64')).toBe('https://x64')
    expect(pickMacDmgDownloadUrl([], 'arm64')).toBeNull()
  })

  it('prefers an arch-matching windows setup exe, falling back to msi', () => {
    const assets = [
      { name: 'Git-Light_0.3.0_x64-setup.exe', browser_download_url: 'https://exe' },
      { name: 'Git-Light_0.3.0_x64_en-US.msi', browser_download_url: 'https://msi' },
    ]
    expect(pickWindowsInstallerUrl(assets, 'x86_64')).toBe('https://exe')
    expect(
      pickWindowsInstallerUrl(
        [{ name: 'Git-Light_0.3.0_x64_en-US.msi', browser_download_url: 'https://msi' }],
        'x86_64',
      ),
    ).toBe('https://msi')
    expect(pickWindowsInstallerUrl([], 'x86_64')).toBeNull()
  })

  it('prefers an arch-matching linux appimage, falling back to deb', () => {
    const assets = [
      { name: 'Git-Light_0.3.0_amd64.AppImage', browser_download_url: 'https://appimage' },
      { name: 'git-light_0.3.0_amd64.deb', browser_download_url: 'https://deb' },
    ]
    expect(pickLinuxInstallerUrl(assets, 'x86_64')).toBe('https://appimage')
    expect(
      pickLinuxInstallerUrl(
        [{ name: 'git-light_0.3.0_amd64.deb', browser_download_url: 'https://deb' }],
        'x86_64',
      ),
    ).toBe('https://deb')
    expect(pickLinuxInstallerUrl([], 'x86_64')).toBeNull()
  })

  it('opens the installer asset directly on windows and linux', async () => {
    const release = {
      tag_name: 'v0.3.0',
      html_url: 'https://releases',
      body: null,
      assets: [
        { name: 'Git-Light_0.3.0_x64-setup.exe', browser_download_url: 'https://exe' },
        { name: 'Git-Light_0.3.0_amd64.AppImage', browser_download_url: 'https://appimage' },
      ],
    }
    for (const [platform, expected] of [
      ['windows', 'https://exe'],
      ['linux', 'https://appimage'],
    ] as const) {
      const opened: string[] = []
      await checkForUpdates({
        source: 'menu',
        currentVersion: '0.2.0',
        fetchRelease: async () => release,
        readSnooze: () => null,
        writeSnooze: vi.fn(),
        askDownload: async () => 'download' as const,
        openDownload: async (url: string) => {
          opened.push(url)
        },
        arch: 'x86_64',
        platform,
      })
      expect(opened).toEqual([expected])
    }
  })

  it('strips markdown from release notes', () => {
    expect(formatReleaseNotes('## New\n- **bold** `code`')).toContain('bold')
    expect(formatReleaseNotes('## New\n- **bold** `code`')).not.toContain('**')
    expect(formatReleaseNotes(null)).toBe('')
  })

  it('prompts download when a newer release exists', async () => {
    const dialog = vi.fn(async () => 'download' as const)
    const opened: string[] = []
    await checkForUpdates({
      source: 'menu',
      currentVersion: '0.2.0',
      fetchRelease: async () => ({
        tag_name: 'v0.3.0',
        html_url: 'https://releases',
        body: 'notes',
        assets: [],
      }),
      readSnooze: () => null,
      writeSnooze: vi.fn(),
      askDownload: dialog,
      openDownload: async (url: string) => {
        opened.push(url)
      },
      arch: 'arm64',
      platform: 'darwin',
    })
    expect(dialog).toHaveBeenCalledOnce()
    expect(opened).toEqual(['https://releases'])
  })

  it('stays silent on startup when up to date or snoozed', async () => {
    const dialog = vi.fn()
    await checkForUpdates({
      source: 'startup',
      currentVersion: '0.3.0',
      fetchRelease: async () => ({
        tag_name: 'v0.3.0',
        html_url: 'https://releases',
        body: null,
        assets: [],
      }),
      readSnooze: () => null,
      writeSnooze: vi.fn(),
      askDownload: dialog,
      openDownload: vi.fn(),
      arch: 'arm64',
      platform: 'darwin',
    })
    expect(dialog).not.toHaveBeenCalled()

    await checkForUpdates({
      source: 'startup',
      currentVersion: '0.2.0',
      fetchRelease: async () => ({
        tag_name: 'v0.3.0',
        html_url: 'https://releases',
        body: null,
        assets: [],
      }),
      readSnooze: () => ({ version: '0.3.0' }),
      writeSnooze: vi.fn(),
      askDownload: dialog,
      openDownload: vi.fn(),
      arch: 'arm64',
      platform: 'darwin',
    })
    expect(dialog).not.toHaveBeenCalled()
  })

  it('records snooze when the user postpones', async () => {
    const writeSnooze = vi.fn()
    await checkForUpdates({
      source: 'menu',
      currentVersion: '0.2.0',
      fetchRelease: async () => ({
        tag_name: 'v0.3.0',
        html_url: 'https://releases',
        body: null,
        assets: [],
      }),
      readSnooze: () => null,
      writeSnooze,
      askDownload: async () => 'later' as const,
      openDownload: vi.fn(),
      arch: 'arm64',
      platform: 'darwin',
    })
    expect(writeSnooze).toHaveBeenCalledWith({ version: '0.3.0' })
  })

  it('picks the arch-matching app.tar.gz for in-place updates', () => {
    const assets = [asset('Git.Light_0.3.0_aarch64.app.tar.gz'), asset('Git-Light_0.3.0_x64.dmg')]
    expect(pickMacTarGzUrl(assets, 'arm64')).toBe('https://example.com/Git.Light_0.3.0_aarch64.app.tar.gz')
    expect(pickMacTarGzUrl([], 'arm64')).toBeNull()
  })

  it('locates CHECKSUMS.txt', () => {
    const assets = [asset('CHECKSUMS.txt'), asset('Git.Light_0.3.0_aarch64.dmg')]
    expect(pickChecksumsUrl(assets)).toBe('https://example.com/CHECKSUMS.txt')
    expect(pickChecksumsUrl([asset('other.dmg')])).toBeNull()
  })

  it('looks up the sha256 entry inside CHECKSUMS.txt', () => {
    const text = [
      '3f6a5c92823b4a4c5f11a33f3bc9837df3a1d6b6a2b7f60f0d17e0eba3d5c9ef  Git.Light_0.3.0_aarch64.app.tar.gz',
      'not-a-hash-line',
    ].join('\n')
    expect(
      lookupChecksum(text, 'Git.Light_0.3.0_aarch64.app.tar.gz'),
    ).toBe('3f6a5c92823b4a4c5f11a33f3bc9837df3a1d6b6a2b7f60f0d17e0eba3d5c9ef')
    expect(lookupChecksum(text, 'missing.pkg')).toBeNull()
  })

  it('routes macOS to the in-place self-update and keeps other platforms on the browser flow', async () => {
    const release = {
      tag_name: 'v0.3.0',
      html_url: 'https://releases',
      body: null,
      assets: [asset('Git.Light_0.3.0_aarch64.app.tar.gz'), asset('CHECKSUMS.txt')],
    }
    const installSelfUpdate = vi.fn(async () => 'installed' as const)
    const openDownload = vi.fn()
    await checkForUpdates({
      source: 'menu',
      currentVersion: '0.2.0',
      fetchRelease: async () => release,
      readSnooze: () => null,
      writeSnooze: vi.fn(),
      askDownload: async () => 'download' as const,
      openDownload,
      installSelfUpdate,
      arch: 'arm64',
      platform: 'darwin',
    })
    expect(installSelfUpdate).toHaveBeenCalledWith(release, 'arm64')
    expect(openDownload).not.toHaveBeenCalled()

    // Falls back to the browser when no tarball exists.
    const openFallback = vi.fn()
    await checkForUpdates({
      source: 'menu',
      currentVersion: '0.2.0',
      fetchRelease: async () => ({ ...release, assets: [asset('Git-Light_0.3.0_arm64.dmg')] }),
      readSnooze: () => null,
      writeSnooze: vi.fn(),
      askDownload: async () => 'download' as const,
      openDownload: openFallback,
      installSelfUpdate: async () => 'open-download' as const,
      arch: 'arm64',
      platform: 'darwin',
    })
    expect(openFallback).toHaveBeenCalled()
  })
})
