import { APP_REPOSITORY, APP_VERSION } from '@shared/app/metadata'

export interface GitHubAsset {
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

const RELEASES_PAGE_URL = `${APP_REPOSITORY}/releases`
const RELEASES_LATEST_API_URL = `${APP_REPOSITORY.replace(
  'https://github.com/',
  'https://api.github.com/repos/',
)}/releases/latest`

function parseSemver(version: string): [number, number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?/.exec(version.trim())
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4] ?? 0)]
}

/** Positive when `a` is newer than `b`, negative when older, 0 when equal. */
export function compareSemver(a: string, b: string): number | null {
  const parsedA = parseSemver(a)
  const parsedB = parseSemver(b)
  if (!parsedA || !parsedB) return null
  for (let i = 0; i < 4; i += 1) {
    if (parsedA[i] !== parsedB[i]) return parsedA[i] - parsedB[i]
  }
  return 0
}

function archHintsFor(arch: string): string[] {
  return arch === 'arm64' || arch === 'aarch64'
    ? ['arm64', 'aarch64']
    : ['x64', 'x86_64', 'amd64', 'intel']
}

/** Prefer an architecture-matching `.dmg` asset; fall back to null. */
export function pickMacDmgDownloadUrl(
  assets: GitHubAsset[],
  arch: string,
): string | null {
  const dmgs = assets.filter((asset) => asset.name.toLowerCase().endsWith('.dmg'))
  if (dmgs.length === 0) return null
  for (const hint of archHintsFor(arch)) {
    const match = dmgs.find((asset) => asset.name.toLowerCase().includes(hint))
    if (match) return match.browser_download_url
  }
  return dmgs[0]?.browser_download_url ?? null
}

/** Prefer an architecture-matching `.app.tar.gz` asset; fall back to any, else null. */
export function pickMacTarGzUrl(assets: GitHubAsset[], arch: string): string | null {
  const tarballs = assets.filter((asset) =>
    asset.name.toLowerCase().endsWith('.app.tar.gz'),
  )
  if (tarballs.length === 0) return null
  for (const hint of archHintsFor(arch)) {
    const match = tarballs.find((asset) => asset.name.toLowerCase().includes(hint))
    if (match) return match.browser_download_url
  }
  return tarballs[0]?.browser_download_url ?? null
}

/** Locate the release `CHECKSUMS.txt` asset, if present. */
export function pickChecksumsUrl(assets: GitHubAsset[]): string | null {
  const checksums = assets.find(
    (asset) => asset.name.toLowerCase() === 'checksums.txt',
  )
  return checksums?.browser_download_url ?? null
}

/** Look up the sha256 entry for `assetName` inside a CHECKSUMS.txt payload. */
export function lookupChecksum(
  checksumsText: string,
  assetName: string,
): string | null {
  for (const line of checksumsText.split('\n')) {
    // GitHub's sha256sum output: "<hex>  <filename>"
    const match = /^([0-9a-fA-F]{64})\s{1,2}\*?(.+)$/.exec(line.trim())
    if (!match) continue
    if (match[2] === assetName) return match[1].toLowerCase()
  }
  return null
}

/** Prefer an arch-matching NSIS `-setup.exe`; fall back to `.msi`, else null. */
export function pickWindowsInstallerUrl(
  assets: GitHubAsset[],
  arch: string,
): string | null {
  const lowered = assets.map((asset) => ({ asset, name: asset.name.toLowerCase() }))
  const exes = lowered.filter(({ name }) => name.endsWith('-setup.exe') || name.endsWith('.exe'))
  const msis = lowered.filter(({ name }) => name.endsWith('.msi'))
  for (const hint of archHintsFor(arch)) {
    const match =
      exes.find(({ name }) => name.includes(hint)) ?? msis.find(({ name }) => name.includes(hint))
    if (match) return match.asset.browser_download_url
  }
  return (
    exes[0]?.asset.browser_download_url ?? msis[0]?.asset.browser_download_url ?? null
  )
}

/** Prefer an arch-matching `.AppImage`; fall back to `.deb`, else null. */
export function pickLinuxInstallerUrl(
  assets: GitHubAsset[],
  arch: string,
): string | null {
  const lowered = assets.map((asset) => ({ asset, name: asset.name.toLowerCase() }))
  const appimages = lowered.filter(({ name }) => name.endsWith('.appimage'))
  const debs = lowered.filter(({ name }) => name.endsWith('.deb'))
  for (const hint of archHintsFor(arch)) {
    const match =
      appimages.find(({ name }) => name.includes(hint)) ??
      debs.find(({ name }) => name.includes(hint))
    if (match) return match.asset.browser_download_url
  }
  return (
    appimages[0]?.asset.browser_download_url ?? debs[0]?.asset.browser_download_url ?? null
  )
}

function resolveDownloadUrl(
  release: GitHubRelease,
  platform: string,
  arch: string,
): string {
  const assets = release.assets ?? []
  if (platform === 'darwin') {
    const dmgUrl = pickMacDmgDownloadUrl(assets, arch)
    if (dmgUrl) return dmgUrl
  } else if (platform === 'windows') {
    const winUrl = pickWindowsInstallerUrl(assets, arch)
    if (winUrl) return winUrl
  } else if (platform === 'linux') {
    const linuxUrl = pickLinuxInstallerUrl(assets, arch)
    if (linuxUrl) return linuxUrl
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

export interface UpdateCheckDeps {
  source: UpdateCheckSource
  currentVersion: string
  fetchRelease: () => Promise<GitHubRelease>
  readSnooze: () => UpdateSnooze | null
  writeSnooze: (snooze: UpdateSnooze) => void
  askDownload: (message: string, detail: string) => Promise<'download' | 'later'>
  openDownload: (url: string) => Promise<void>
  /**
   * macOS only: download + verify + swap the app bundle in place.
   * Returns `'installed'` when the self-update took over, `'open-download'` to
   * fall back to the browser flow. Undefined on other platforms.
   */
  installSelfUpdate?: (
    release: GitHubRelease,
    arch: string,
  ) => Promise<'installed' | 'open-download'>
  /** Explains what "Download" does in the platform-appropriate way. */
  selfUpdateHint?: string
  arch: string
  platform: string
}

export async function checkForUpdates(deps: UpdateCheckDeps): Promise<void> {
  const { source, currentVersion } = deps
  let release: GitHubRelease
  try {
    release = await deps.fetchRelease()
  } catch {
    return
  }
  const latestVersion = release.tag_name.replace(/^v/, '')
  const comparison = compareSemver(latestVersion, currentVersion)
  if (comparison === null || comparison <= 0) return
  if (source === 'startup' && deps.readSnooze()?.version === latestVersion) return

  const releaseNotes = formatReleaseNotes(release.body)
  const detailLines = [`You are running v${currentVersion}.`]
  if (releaseNotes) detailLines.push('', "What's new:", releaseNotes)
  detailLines.push('', deps.selfUpdateHint ?? 'Download starts the installer from GitHub.')
  const choice = await deps.askDownload(
    `Version ${latestVersion} is available.`,
    detailLines.join('\n'),
  )
  if (choice === 'download') {
    if (deps.installSelfUpdate) {
      const outcome = await deps.installSelfUpdate(release, deps.arch)
      if (outcome === 'installed') return // install succeeded; app restarts on its own
    }
    await deps.openDownload(resolveDownloadUrl(release, deps.platform, deps.arch))
    return
  }
  deps.writeSnooze({ version: latestVersion })
}

export async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await fetch(RELEASES_LATEST_API_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `Git Light/${APP_VERSION}`,
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

export { RELEASES_PAGE_URL }
