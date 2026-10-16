import { ask } from '@tauri-apps/plugin-dialog'
import { arch, platform } from '@tauri-apps/plugin-os'
import { APP_VERSION } from '@shared/app/metadata'
import { openExternalUrl } from './appBridge'
import {
  checkForUpdates,
  fetchLatestRelease,
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

/** Check GitHub Releases and offer the installer. */
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
    arch: arch(),
    platform: platform(),
  })
}
