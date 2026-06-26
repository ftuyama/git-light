import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import Store from 'electron-store'
import { AppIpcChannels } from '@shared/app/ipc'
import {
  APP_AUTHOR,
  APP_DESCRIPTION,
  APP_HOMEPAGE,
  APP_NAME,
  APP_VERSION,
} from '@shared/app/metadata'
import { registerGitIpc } from './git/registerIpc'
import { buildApplicationMenu } from './menu'
import { checkForUpdates } from './updateCheck'

if (process.platform === 'darwin') {
  app.setName(APP_NAME)
  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: APP_VERSION,
    version: APP_VERSION,
    copyright: `Copyright © ${new Date().getFullYear()} ${APP_AUTHOR}`,
    website: APP_HOMEPAGE,
    credits: APP_DESCRIPTION,
  })
}

const store = new Store({ name: 'git-light-ui' })
let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#12151a',
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

app.whenReady().then(() => {
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
