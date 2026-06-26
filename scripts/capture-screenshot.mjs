import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const { app, BrowserWindow } = require('electron')
const OUT = join(process.cwd(), 'docs/screenshot.png')
const URL = process.env.CAPTURE_URL ?? 'http://localhost:5173/'
async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Server not ready at ${url}`)
}

app.commandLine.appendSwitch('disable-http-cache')
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.whenReady().then(async () => {
  await waitForServer(URL)
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    backgroundColor: '#12151a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  win.webContents.setZoomFactor(1)
  if (typeof win.webContents.setVisualZoomLevelLimits === 'function') {
    win.webContents.setVisualZoomLevelLimits(1, 1)
  }
  await win.loadURL(URL)
  await new Promise((r) => setTimeout(r, 5000))
  const image = await win.capturePage()
  writeFileSync(OUT, image.toPNG())
  const size = image.getSize()
  console.log(`Wrote ${OUT} (${size.width}x${size.height})`)
  app.quit()
})
app.on('window-all-closed', () => app.quit())
