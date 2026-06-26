import { Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { APP_HOMEPAGE, APP_NAME, APP_REPOSITORY } from '@shared/app/metadata'
import { checkForUpdates } from './updateCheck'

function darwinAppMenu(): MenuItemConstructorOptions {
  return {
    label: APP_NAME,
    submenu: [
      { label: `About ${APP_NAME}`, role: 'about' },
      {
        label: 'Check for Updates…',
        click: () => {
          void checkForUpdates({ source: 'menu' })
        },
      },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  }
}

export function buildApplicationMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [darwinAppMenu()] : [{ role: 'fileMenu' as const }]),
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: `${APP_NAME} Website`,
          click: () => {
            void shell.openExternal(APP_HOMEPAGE)
          },
        },
        {
          label: 'View on GitHub',
          click: () => {
            void shell.openExternal(APP_REPOSITORY)
          },
        },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}
