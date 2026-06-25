import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import Store from 'electron-store'

const store = new Store({ name: 'git-light-ui' })

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#0d0f14',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('focus', () => win.webContents.send('window:focus'))
  win.on('blur', () => win.webContents.send('window:blur'))

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Persisted UI state bridge (sidebar sizes, collapsed state, etc.).
ipcMain.handle('store:get', (_event, key: string, fallback: unknown) => {
  return store.get(key, fallback)
})

ipcMain.handle('store:set', (_event, key: string, value: unknown) => {
  store.set(key, value)
})

// Stubbed git action endpoint. A real GitService implementation can replace
// this handler with spawn('git', ...) / libgit2 calls without UI changes.
ipcMain.handle('git:action', async (_event, action: unknown) => {
  return { ok: true, action }
})

ipcMain.handle('app:open-external', (_event, url: string) => {
  return shell.openExternal(url)
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
