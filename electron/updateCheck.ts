import { app, dialog, shell } from 'electron'
import Store from 'electron-store'
import { APP_NAME, APP_REPOSITORY, APP_VERSION } from '@shared/app/metadata'

export const RELEASES_PAGE_URL = `${APP_REPOSITORY}/releases`
export const RELEASES_LATEST_API_URL = `${APP_REPOSITORY.replace('https://github.com/', 'https://api.github.com/repos/')}/releases/latest`
export const UPDATE_SNOOZE_STORE_KEY = 'git-light:update-snooze'

interface GitHubAsset {
  name: string
  browser_download_url: string
}

export interface GitHubRelease {
  tag_name: string
  html_url: string
  body?: string | null
  assets?: GitHubAsset[]
}

export interface UpdateSnooze {
  version: string
}

export type UpdateCheckSource = 'menu' | 'startup'

let updateStore: Store | null = null

function getUpdateStore(): Store {
  if (!updateStore) {
    updateStore = new Store({ name: 'git-light-ui' })
  }
  return updateStore
}

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

/** Prefer an architecture-matching `.dmg` asset; fall back to the releases page. */
export function pickMacDmgDownloadUrl(
  assets: GitHubAsset[],
  arch: string = process.arch,
): string | null {
  const dmgs = assets.filter((asset) => asset.name.toLowerCase().endsWith('.dmg'))
  if (dmgs.length === 0) return null

  const archHints =
    arch === 'arm64' ? ['arm64', 'aarch64'] : ['x64', 'x86_64', 'intel', 'amd64']

  for (const hint of archHints) {
    const match = dmgs.find((asset) => asset.name.toLowerCase().includes(hint))
    if (match) return match.browser_download_url
  }

  return dmgs[0]?.browser_download_url ?? null
}

export function resolveDownloadUrl(
  release: GitHubRelease,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string {
  if (platform === 'darwin') {
    const dmgUrl = pickMacDmgDownloadUrl(release.assets ?? [], arch)
    if (dmgUrl) return dmgUrl
  }

  return release.html_url
}

/** Strip common Markdown so release notes read cleanly in a native dialog. */
export function formatReleaseNotes(body: string | null | undefined, maxLength = 800): string {
  if (!body?.trim()) return ''

  let text = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*+]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (text.length > maxLength) {
    text = `${text.slice(0, maxLength - 1).trimEnd()}…`
  }

  return text
}

export function formatUpdateAvailableDetail({
  currentVersion,
  releaseNotes,
}: {
  currentVersion: string
  releaseNotes: string
}): string {
  const lines = [`You are running v${currentVersion}.`]

  if (releaseNotes) {
    lines.push('', "What's new:", releaseNotes)
  }

  lines.push('', 'Download starts the installer from GitHub.')
  return lines.join('\n')
}

export function shouldSkipStartupUpdatePrompt(
  latestVersion: string,
  snooze: UpdateSnooze | null | undefined,
): boolean {
  return snooze?.version === latestVersion
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

  return {
    tag_name: release.tag_name,
    html_url: release.html_url,
    body: release.body,
    assets: release.assets,
  }
}

function currentAppVersion(): string {
  const runtimeVersion = app.getVersion().trim()
  return runtimeVersion || APP_VERSION
}

function readUpdateSnooze(): UpdateSnooze | null {
  const value = getUpdateStore().get(UPDATE_SNOOZE_STORE_KEY, null)
  if (!value || typeof value !== 'object') return null

  const version = (value as Partial<UpdateSnooze>).version
  return typeof version === 'string' && version.trim() ? { version: version.trim() } : null
}

function writeUpdateSnooze(snooze: UpdateSnooze | null): void {
  if (snooze) {
    getUpdateStore().set(UPDATE_SNOOZE_STORE_KEY, snooze)
    return
  }

  getUpdateStore().delete(UPDATE_SNOOZE_STORE_KEY)
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

    if (source === 'startup' && shouldSkipStartupUpdatePrompt(latestVersion, readUpdateSnooze())) {
      return
    }

    const releaseNotes = formatReleaseNotes(release.body)
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `Version ${latestVersion} is available.`,
      detail: formatUpdateAvailableDetail({ currentVersion, releaseNotes }),
      buttons: ['Download', 'Remind Me Later'],
      defaultId: 0,
      cancelId: 1,
    })

    if (response === 0) {
      await shell.openExternal(resolveDownloadUrl(release))
      return
    }

    if (response === 1) {
      writeUpdateSnooze({ version: latestVersion })
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
