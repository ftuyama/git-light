import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, Menu, nativeImage, nativeTheme, shell } from 'electron'
import Store from 'electron-store'
import { AppIpcChannels } from '@shared/app/ipc'
import {
  APP_AUTHOR,
  APP_HOMEPAGE,
  APP_MAKER,
  APP_NAME,
  APP_VERSION,
} from '@shared/app/metadata'
import { formatAboutCredits } from '@shared/app/credits'
import { registerGitIpc } from './git/registerIpc'
import { buildApplicationMenu } from './menu'
import { checkForUpdates } from './updateCheck'

app.setName(APP_NAME)

if (!app.isPackaged) {
  app.setPath('userData', join(app.getPath('appData'), APP_NAME))
}

app.setAboutPanelOptions({
  applicationName: APP_NAME,
  applicationVersion: APP_VERSION,
  version: APP_VERSION,
  copyright: `Copyright © ${new Date().getFullYear()} ${APP_AUTHOR}`,
  website: APP_HOMEPAGE,
  authors: [APP_MAKER],
  credits: formatAboutCredits(),
})

const store = new Store({ name: 'git-light-ui' })
let mainWindow: BrowserWindow | null = null

const THEME_APP_COLORS: Record<string, string> = {
  default: '#12151a',
  dracula: '#282a36',
  light: '#ffffff',
  claude: '#141413',
}

function startupBackgroundColor(): string {
  const prefs = store.get('git-light:preferences', null) as { theme?: string } | null
  const theme = prefs?.theme ?? 'default'
  if (theme === 'system') {
    return nativeTheme.shouldUseDarkColors ? THEME_APP_COLORS.default : THEME_APP_COLORS.light
  }
  return THEME_APP_COLORS[theme] ?? THEME_APP_COLORS.default
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: APP_NAME,
    backgroundColor: startupBackgroundColor(),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow = win

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('focus', () => win.webContents.send(AppIpcChannels.windowFocus))
  win.on('blur', () => win.webContents.send(AppIpcChannels.windowBlur))

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

ipcMain.handle(AppIpcChannels.storeGet, (_event, { key, fallback }: { key: string; fallback: unknown }) => {
  return store.get(key, fallback)
})

ipcMain.handle(AppIpcChannels.storeSet, (_event, { key, value }: { key: string; value: unknown }) => {
  store.set(key, value)
})

ipcMain.handle(AppIpcChannels.openExternal, (_event, { url }: { url: string }) => {
  return shell.openExternal(url)
})

ipcMain.handle(AppIpcChannels.setWindowBackgroundColor, (_event, { color }: { color: string }) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBackgroundColor(color)
  }
})

app.whenReady().then(() => {
  if (process.platform === 'darwin' && !app.isPackaged && app.dock) {
    const icon = nativeImage.createFromPath(join(__dirname, '../../build/icon.png'))
    if (!icon.isEmpty()) app.dock.setIcon(icon)
  }

  Menu.setApplicationMenu(buildApplicationMenu())
  registerGitIpc(() => mainWindow, store)
  createWindow()

  if (app.isPackaged) {
    setTimeout(() => {
      void checkForUpdates({ source: 'startup' })
    }, 3000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
