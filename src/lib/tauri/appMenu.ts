import { Menu, MenuItem, PredefinedMenuItem, Submenu, CheckMenuItem } from '@tauri-apps/api/menu'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  APP_AUTHOR,
  APP_DESCRIPTION,
  APP_HOMEPAGE,
  APP_LICENSE,
  APP_MAKER,
  APP_NAME,
  APP_REPOSITORY,
  APP_VERSION,
} from '@shared/app/metadata'
import type { CommandId, KeyBinding } from '@/lib/keybindings'
import { useUiStore } from '@/stores/ui'
import { useRepositoryStore } from '@/stores/repository'
import { useRepoTabsStore } from '@/stores/repoTabs'
import {
  closeActiveRepositoryTab,
  reopenClosedRepositoryTab,
  switchToRepositoryTab,
} from '@/composables/useRepoActions'
import { cloneRepository, initRepository } from './repoCommands'
import { tauriAppRelaunch } from './commands'
import { RELEASES_PAGE_URL } from './updater'
import { openExternalUrl } from './appBridge'
import { runUpdateCheck } from './updateCheck'

export const appMenuLabels = {
  checkForUpdates: 'Check for Updates…',
  settings: 'Settings…',
  quit: `Quit ${APP_NAME}`,
  file: 'File',
  newTab: 'New Tab',
  closeTab: 'Close Tab',
  reopenClosedTab: 'Reopen Closed Tab',
  openRepository: 'Open Repository…',
  cloneRepository: 'Clone Repository…',
  initRepository: 'Initialize Repository…',
  view: 'View',
  relaunch: `Relaunch ${APP_NAME}`,
  fullscreen: 'Toggle Full Screen',
  zoomIn: 'Increase Zoom',
  zoomOut: 'Decrease Zoom',
  zoomReset: 'Reset Zoom',
  window: 'Window',
  minimize: 'Minimize',
  zoomWindow: 'Zoom',
  tabs: 'Tabs',
  noOpenTabs: 'No Open Tabs',
  help: 'Help',
  website: 'Git Light Website',
  github: 'GitHub Repository',
  issues: 'Report an Issue',
  releases: 'Releases & Downloads',
} as const

export const HELP_ITEMS = [
  { label: appMenuLabels.website, url: APP_HOMEPAGE },
  { label: appMenuLabels.github, url: APP_REPOSITORY },
  { label: appMenuLabels.issues, url: `${APP_REPOSITORY}/issues` },
  { label: appMenuLabels.releases, url: RELEASES_PAGE_URL },
] as const

/** Zoom bounds and step for the webview (1 = 100%). */
export const APP_ZOOM_MIN = 0.5
export const APP_ZOOM_MAX = 2
export const APP_ZOOM_STEP = 0.1

/** Clamp a zoom factor into the supported range and round off float drift. */
export function clampZoom(value: number): number {
  const clamped = Math.min(APP_ZOOM_MAX, Math.max(APP_ZOOM_MIN, value))
  return Math.round(clamped * 100) / 100
}

/** Step a zoom factor up (+1) or down (-1), clamped to the supported range. */
export function nextZoom(current: number, direction: 1 | -1): number {
  return clampZoom(current + direction * APP_ZOOM_STEP)
}

const ACCELERATOR_KEYS: Record<string, string> = {
  '=': 'Equal',
  '-': 'Minus',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  ';': 'Semicolon',
  "'": 'Quote',
  '`': 'Backquote',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
  tab: 'Tab',
  space: 'Space',
  enter: 'Enter',
  escape: 'Escape',
  backspace: 'Backspace',
  delete: 'Delete',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
}

/** Convert an app keybinding to a Tauri menu accelerator, or null when unsupported. */
export function bindingToAccelerator(binding: KeyBinding): string | null {
  const key =
    ACCELERATOR_KEYS[binding.key] ?? (/^[a-z0-9]$/.test(binding.key) ? binding.key.toUpperCase() : null)
  if (!key) return null
  const parts: string[] = []
  if (binding.ctrlMeta) parts.push('CmdOrCtrl')
  if (binding.alt) parts.push('Alt')
  if (binding.shift) parts.push('Shift')
  parts.push(key)
  return parts.join('+')
}

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return true
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    ''
  return /mac/i.test(platform)
}

/** Resolve the accelerator for a command from the live keymap, with a fallback. */
function acceleratorFor(command: CommandId, fallback?: string): string | undefined {
  const bindings = useUiStore().keybindings[command] ?? []
  for (const binding of bindings) {
    const accelerator = bindingToAccelerator(binding)
    if (accelerator) return accelerator
  }
  return fallback
}

let zoomLevel = 1

async function applyZoom(next: number): Promise<void> {
  zoomLevel = clampZoom(next)
  try {
    await getCurrentWebview().setZoom(zoomLevel)
  } catch (err) {
    console.error('[git-light] set zoom failed:', err)
  }
}

async function minimizeWindow(): Promise<void> {
  try {
    await getCurrentWindow().minimize()
  } catch (err) {
    console.error('[git-light] minimize window failed:', err)
  }
}

/** macOS-style "Zoom": toggle between maximized and restored window size. */
async function toggleMaximizeWindow(): Promise<void> {
  try {
    const win = getCurrentWindow()
    if (await win.isMaximized()) await win.unmaximize()
    else await win.maximize()
  } catch (err) {
    console.error('[git-light] toggle maximize failed:', err)
  }
}

async function toggleFullscreen(): Promise<void> {
  try {
    const win = getCurrentWindow()
    const wasFullscreen = await win.isFullscreen()
    await win.setFullscreen(!wasFullscreen)
  } catch (err) {
    console.error('[git-light] toggle fullscreen failed:', err)
  }
}

function relaunch(): void {
  void tauriAppRelaunch().catch((err) => console.error('[git-light] relaunch failed:', err))
}

let tabsSubmenu: Submenu | null = null
let tabsSubscribed = false
let tabsRefreshTimer: ReturnType<typeof setTimeout> | undefined
let tabsRefreshChain: Promise<void> = Promise.resolve()

/** Rebuild the Window → Tabs submenu from the current tabs store. */
async function refreshTabsMenu(): Promise<void> {
  const submenu = tabsSubmenu
  if (!submenu) return
  const tabsStore = useRepoTabsStore()
  const existing = await submenu.items()
  for (const item of existing) await submenu.remove(item)

  const tabs = tabsStore.tabs
  if (tabs.length === 0) {
    const empty = await MenuItem.new({
      id: 'window-tab-empty',
      text: appMenuLabels.noOpenTabs,
      enabled: false,
    })
    await submenu.append(empty)
    return
  }

  const items = await Promise.all(
    tabs.map((tab, index) =>
      CheckMenuItem.new({
        id: `window-tab-${index}`,
        text: tab.name,
        checked: tab.path === tabsStore.activePath,
        action: () => {
          void switchToRepositoryTab(tab.path)
        },
      }),
    ),
  )
  await submenu.append(items)
}

function scheduleTabsRefresh(): void {
  if (tabsRefreshTimer) return
  tabsRefreshTimer = setTimeout(() => {
    tabsRefreshTimer = undefined
    // Chain refreshes so overlapping tab mutations cannot interleave the
    // remove/append calls on the live native submenu.
    tabsRefreshChain = tabsRefreshChain
      .then(refreshTabsMenu)
      .catch((err) => console.error('[git-light] tabs menu refresh failed:', err))
  }, 30)
}

/** Build + install the native app/window menu. */
export async function setupAppMenu(): Promise<void> {
  const ui = useUiStore()
  const repo = useRepositoryStore()
  const isMac = isMacPlatform()

  const about = await PredefinedMenuItem.new({
    item: {
      About: {
        name: APP_NAME,
        version: APP_VERSION,
        authors: [APP_AUTHOR],
        comments: APP_DESCRIPTION,
        copyright: `Copyright © ${new Date().getFullYear()} ${APP_MAKER}`,
        license: APP_LICENSE,
        website: APP_HOMEPAGE,
        websiteLabel: appMenuLabels.website,
        credits: 'Built with Tauri, Vue and Rust. MIT licensed.',
      },
    },
  })
  const checkUpdates = await MenuItem.new({
    id: 'check-for-updates',
    text: appMenuLabels.checkForUpdates,
    action: () => {
      void runUpdateCheck('menu')
    },
  })
  const settings = await MenuItem.new({
    id: 'open-settings',
    text: appMenuLabels.settings,
    accelerator: 'CmdOrCtrl+Comma',
    action: () => {
      ui.openSettings()
    },
  })
  const appLinks = await Promise.all(
    HELP_ITEMS.map((entry) =>
      MenuItem.new({
        id: `app-link-${entry.label}`,
        text: entry.label,
        action: () => {
          void openExternalUrl(entry.url)
        },
      }),
    ),
  )

  const appItems: Array<Submenu | MenuItem | PredefinedMenuItem | CheckMenuItem> = [about]
  appItems.push(await PredefinedMenuItem.new({ item: 'Separator' }), checkUpdates, settings)
  appItems.push(await PredefinedMenuItem.new({ item: 'Separator' }), ...appLinks)
  if (isMac) {
    appItems.push(
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ item: 'Hide' }),
      await PredefinedMenuItem.new({ item: 'HideOthers' }),
      await PredefinedMenuItem.new({ item: 'ShowAll' }),
    )
  }
  appItems.push(
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await PredefinedMenuItem.new({ item: 'Quit', text: appMenuLabels.quit }),
  )
  const appSubmenu = await Submenu.new({ id: 'app', text: APP_NAME, items: appItems })

  const fileSubmenu = await Submenu.new({
    id: 'file',
    text: appMenuLabels.file,
    items: [
      await MenuItem.new({
        id: 'new-tab',
        text: appMenuLabels.newTab,
        accelerator: acceleratorFor('newTab', 'CmdOrCtrl+T'),
        action: () => {
          void repo.pickAndOpenRepository()
        },
      }),
      await MenuItem.new({
        id: 'close-tab',
        text: appMenuLabels.closeTab,
        accelerator: acceleratorFor('closeTab', 'CmdOrCtrl+W'),
        action: () => {
          void closeActiveRepositoryTab()
        },
      }),
      await MenuItem.new({
        id: 'reopen-closed-tab',
        text: appMenuLabels.reopenClosedTab,
        accelerator: acceleratorFor('reopenClosedTab', 'CmdOrCtrl+Shift+T'),
        action: () => {
          void reopenClosedRepositoryTab()
        },
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        id: 'file-clone-repository',
        text: appMenuLabels.cloneRepository,
        action: () => {
          void cloneRepository()
        },
      }),
      await MenuItem.new({
        id: 'file-init-repository',
        text: appMenuLabels.initRepository,
        action: () => {
          void initRepository()
        },
      }),
      await MenuItem.new({
        id: 'file-open-repository',
        text: appMenuLabels.openRepository,
        action: () => {
          void repo.pickAndOpenRepository()
        },
      }),
    ],
  })

  const viewSubmenu = await Submenu.new({
    id: 'view',
    text: appMenuLabels.view,
    items: [
      await MenuItem.new({
        id: 'relaunch',
        text: appMenuLabels.relaunch,
        action: relaunch,
      }),
      await MenuItem.new({
        id: 'toggle-fullscreen',
        text: appMenuLabels.fullscreen,
        accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11',
        action: () => {
          void toggleFullscreen()
        },
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        id: 'zoom-in',
        text: appMenuLabels.zoomIn,
        accelerator: 'CmdOrCtrl+Shift+Equal',
        action: () => {
          void applyZoom(nextZoom(zoomLevel, 1))
        },
      }),
      await MenuItem.new({
        id: 'zoom-out',
        text: appMenuLabels.zoomOut,
        accelerator: 'CmdOrCtrl+Shift+Minus',
        action: () => {
          void applyZoom(nextZoom(zoomLevel, -1))
        },
      }),
      await MenuItem.new({
        id: 'zoom-reset',
        text: appMenuLabels.zoomReset,
        accelerator: 'CmdOrCtrl+Shift+0',
        action: () => {
          void applyZoom(1)
        },
      }),
    ],
  })

  tabsSubmenu = await Submenu.new({ id: 'window-tabs', text: appMenuLabels.tabs, items: [] })
  const windowSubmenu = await Submenu.new({
    id: 'window',
    text: appMenuLabels.window,
    items: [
      await MenuItem.new({
        id: 'window-minimize',
        text: appMenuLabels.minimize,
        action: () => {
          void minimizeWindow()
        },
      }),
      await MenuItem.new({
        id: 'window-zoom',
        text: appMenuLabels.zoomWindow,
        action: () => {
          void toggleMaximizeWindow()
        },
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      tabsSubmenu,
    ],
  })

  const helpEntries = await Promise.all(
    HELP_ITEMS.map((entry) =>
      MenuItem.new({
        id: `help-${entry.label}`,
        text: entry.label,
        action: () => {
          void openExternalUrl(entry.url)
        },
      }),
    ),
  )
  const helpSubmenu = await Submenu.new({
    id: 'help',
    text: appMenuLabels.help,
    items: helpEntries,
  })

  const menu = await Menu.new({
    items: [appSubmenu, fileSubmenu, viewSubmenu, windowSubmenu, helpSubmenu],
  })
  await menu.setAsAppMenu()
  await menu.setAsWindowMenu()
  if (isMac) {
    await windowSubmenu.setAsWindowsMenuForNSApp()
    await helpSubmenu.setAsHelpMenuForNSApp()
  }

  await refreshTabsMenu()
  if (!tabsSubscribed) {
    tabsSubscribed = true
    useRepoTabsStore().$subscribe(scheduleTabsRefresh, { detached: true })
  }
}
