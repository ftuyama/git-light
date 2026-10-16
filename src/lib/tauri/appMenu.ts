import { Menu } from '@tauri-apps/api/menu'
import { MenuItem } from '@tauri-apps/api/menu'
import { PredefinedMenuItem } from '@tauri-apps/api/menu'
import { Submenu } from '@tauri-apps/api/menu'
import {
  APP_AUTHOR,
  APP_HOMEPAGE,
  APP_NAME,
  APP_VERSION,
} from '@shared/app/metadata'
import { RELEASES_PAGE_URL } from './updater'
import { openExternalUrl } from './appBridge'
import { runUpdateCheck } from './updateCheck'

export const appMenuLabels = {
  checkForUpdates: 'Check for Updates…',
  quit: `Quit ${APP_NAME}`,
  help: 'Help',
  website: 'Git Light Website',
  releases: 'Releases & Downloads',
} as const

export const HELP_ITEMS = [
  { label: appMenuLabels.website, url: APP_HOMEPAGE },
  { label: appMenuLabels.releases, url: RELEASES_PAGE_URL },
] as const

/** Build + install the native app/window menu. */
export async function setupAppMenu(): Promise<void> {
  const checkUpdates = await MenuItem.new({
    id: 'check-for-updates',
    text: appMenuLabels.checkForUpdates,
    action: () => {
      void runUpdateCheck('menu')
    },
  })
  const about = await PredefinedMenuItem.new({
    item: {
      About: {
        name: APP_NAME,
        version: APP_VERSION,
        authors: [APP_AUTHOR],
        website: APP_HOMEPAGE,
      },
    },
  })
  const quit = await PredefinedMenuItem.new({ item: 'Quit', text: appMenuLabels.quit })
  const separator = await PredefinedMenuItem.new({ item: 'Separator' })
  const appSubmenu = await Submenu.new({
    id: 'app',
    text: APP_NAME,
    items: [about, checkUpdates, separator, quit],
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

  const menu = await Menu.new({ items: [appSubmenu, helpSubmenu] })
  await menu.setAsAppMenu()
  await menu.setAsWindowMenu()
}
