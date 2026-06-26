import { app, dialog, shell } from 'electron'
import { APP_NAME, APP_REPOSITORY } from '@shared/app/metadata'

const RELEASES_LATEST_URL = `${APP_REPOSITORY}/releases/latest`

interface GitHubRelease {
  tag_name: string
  html_url: string
}

export type UpdateCheckSource = 'menu' | 'startup'

function parseSemver(version: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim())
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** Returns positive if `a` is newer than `b`, negative if older, 0 if equal. */
export function compareSemver(a: string, b: string): number | null {
  const parsedA = parseSemver(a)
  const parsedB = parseSemver(b)
  if (!parsedA || !parsedB) return null

  for (let i = 0; i < 3; i += 1) {
    if (parsedA[i] !== parsedB[i]) return parsedA[i] - parsedB[i]
  }
  return 0
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await fetch(RELEASES_LATEST_URL, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}`)
  }
  return (await response.json()) as GitHubRelease
}

export async function checkForUpdates({ source }: { source: UpdateCheckSource }): Promise<void> {
  const currentVersion = app.getVersion()

  try {
    const release = await fetchLatestRelease()
    const latestVersion = release.tag_name.replace(/^v/, '')
    const comparison = compareSemver(latestVersion, currentVersion)

    if (comparison === null) {
      throw new Error('Could not compare versions')
    }

    if (comparison <= 0) {
      if (source === 'menu') {
        await dialog.showMessageBox({
          type: 'info',
          title: APP_NAME,
          message: `You're running the latest version (${currentVersion}).`,
        })
      }
      return
    }

    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `Version ${latestVersion} is available.`,
      detail: `You are running ${currentVersion}.`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
    })

    if (response === 0) {
      await shell.openExternal(release.html_url)
    }
  } catch {
    if (source === 'menu') {
      await dialog.showMessageBox({
        type: 'warning',
        title: APP_NAME,
        message: 'Could not check for updates.',
        detail: 'Check your network connection or visit GitHub Releases manually.',
      })
    }
  }
}
