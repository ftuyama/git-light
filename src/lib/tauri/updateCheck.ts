import { ask, message } from '@tauri-apps/plugin-dialog'
import { arch, platform } from '@tauri-apps/plugin-os'
import { APP_VERSION } from '@shared/app/metadata'
import { openExternalUrl } from './appBridge'
import { selfUpdate } from './appSelfUpdate'
import {
  checkForUpdates,
  fetchLatestRelease,
  lookupChecksum,
  pickChecksumsUrl,
  pickMacTarGzUrl,
  type UpdateCheckSource,
  type UpdateSnooze,
} from './updater'

const SNOOZE_KEY = 'git-light:update-snooze'

function readSnooze(): UpdateSnooze | null {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<UpdateSnooze>
    return typeof parsed.version === 'string' && parsed.version ? { version: parsed.version } : null
  } catch {
    return null
  }
}

function writeSnooze(snooze: UpdateSnooze): void {
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(snooze))
  } catch {
    /* storage unavailable */
  }
}

/**
 * Download the release asset inside the app and self-update (macOS only).
 * Replaces /Applications/Git Light.app and restarts without leaving quarantine,
 * so Gatekeeper never blocks the update. Falls back to the browser flow on failure.
 */
async function installInPlace(assetUrl: string, checksumsUrl: string | null, assetName: string): Promise<void> {
  let expected: string | undefined
  if (checksumsUrl) {
    try {
      const response = await fetch(checksumsUrl)
      if (response.ok) expected = lookupChecksum(await response.text(), assetName) ?? undefined
    } catch {
      /* no checksums available — proceed without verification */
    }
  }
  await selfUpdate(assetUrl, expected)
}

/** Check GitHub Releases and offer the installer (in-place self-update on macOS). */
export async function runUpdateCheck(source: UpdateCheckSource): Promise<void> {
  await checkForUpdates({
    source,
    currentVersion: APP_VERSION,
    fetchRelease: fetchLatestRelease,
    readSnooze,
    writeSnooze,
    askDownload: async (title, detail) => {
      const yes = await ask(`${title}\n\n${detail}`, { title, kind: 'info' })
      return yes ? 'download' : 'later'
    },
    openDownload: (url) => openExternalUrl(url),
    showMessage: async (title, detail) => {
      await message(detail, { title, kind: 'info' })
    },
    installSelfUpdate:
      platform() === 'macos'
        ? async (release, releaseArch) => {
            const assets = release.assets ?? []
            const tarball = assets.find((a) => a.browser_download_url === pickMacTarGzUrl(assets, releaseArch))
            if (!tarball) return 'open-download' as const
            try {
              await installInPlace(tarball.browser_download_url, pickChecksumsUrl(assets), tarball.name)
              return 'installed' as const
            } catch (error) {
              // Never strand the user: fall back to the browser download.
              console.error('[git-light] in-place update failed:', error)
              await message(
                'In-place update failed, opening the GitHub download page instead.',
                { title: 'Update failed', kind: 'warning' },
              )
              return 'open-download' as const
            }
          }
        : undefined,
    arch: arch(),
    platform: platform(),
    selfUpdateHint:
      platform() === 'macos'
        ? '"Download" installs the new version in place and restarts the app.'
        : 'Download starts the installer from GitHub.',
  })
}
