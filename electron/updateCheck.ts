import { app, dialog, shell } from 'electron'
import { APP_NAME, APP_REPOSITORY, APP_VERSION } from '@shared/app/metadata'

export const RELEASES_PAGE_URL = `${APP_REPOSITORY}/releases`
export const RELEASES_LATEST_API_URL = `${APP_REPOSITORY.replace('https://github.com/', 'https://api.github.com/repos/')}/releases/latest`

interface GitHubRelease {
  tag_name: string
  html_url: string
}

export type UpdateCheckSource = 'menu' | 'startup'

function parseSemver(version: string): [number, number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?/.exec(version.trim())
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4] ?? 0)]
}

/** Returns positive if `a` is newer than `b`, negative if older, 0 if equal. */
export function compareSemver(a: string, b: string): number | null {
  const parsedA = parseSemver(a)
  const parsedB = parseSemver(b)
  if (!parsedA || !parsedB) return null

  for (let i = 0; i < 4; i += 1) {
    if (parsedA[i] !== parsedB[i]) return parsedA[i] - parsedB[i]
  }
  return 0
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await fetch(RELEASES_LATEST_API_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `${APP_NAME}/${APP_VERSION}`,
    },
  })
  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}`)
  }

  const release = (await response.json()) as Partial<GitHubRelease>
  if (!release.tag_name || !release.html_url) {
    throw new Error('GitHub API response missing release fields')
  }

  return release as GitHubRelease
}

function currentAppVersion(): string {
  const runtimeVersion = app.getVersion().trim()
  return runtimeVersion || APP_VERSION
}

export function formatCurrentVersionMessage({
  comparison,
  currentVersion,
  latestVersion,
}: {
  comparison: number
  currentVersion: string
  latestVersion: string
}): { message: string; detail?: string } {
  if (comparison === 0) {
    return {
      message: `You're up to date (v${currentVersion}).`,
      detail: 'This matches the latest release on GitHub.',
    }
  }

  return {
    message: `You're running a newer version (v${currentVersion}).`,
    detail: `The latest release on GitHub is v${latestVersion}.`,
  }
}

export async function checkForUpdates({ source }: { source: UpdateCheckSource }): Promise<void> {
  const currentVersion = currentAppVersion()

  try {
    const release = await fetchLatestRelease()
    const latestVersion = release.tag_name.replace(/^v/, '')
    const comparison = compareSemver(latestVersion, currentVersion)

    if (comparison === null) {
      throw new Error(`Could not compare versions (${latestVersion} vs ${currentVersion})`)
    }

    if (comparison <= 0) {
      if (source === 'menu') {
        const { message, detail } = formatCurrentVersionMessage({
          comparison,
          currentVersion,
          latestVersion,
        })
        await dialog.showMessageBox({
          type: 'info',
          title: APP_NAME,
          message,
          detail,
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
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error('Update check failed:', reason, error)
    if (source === 'menu') {
      const devDetail = !app.isPackaged ? `\n\n${reason}` : ''
      await dialog.showMessageBox({
        type: 'warning',
        title: APP_NAME,
        message: 'Could not check for updates.',
        detail: `Check your network connection or visit ${RELEASES_PAGE_URL} manually.${devDetail}`,
      })
    }
  }
}
