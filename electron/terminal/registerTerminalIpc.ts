import * as pty from 'node-pty'
import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import { AppIpcChannels } from '@shared/app/ipc'

const sessions = new Map<string, pty.IPty>()

function defaultShell(): string {
  if (process.platform === 'win32') return process.env.COMSPEC ?? 'powershell.exe'
  return process.env.SHELL ?? '/bin/zsh'
}

function killSession(id: string): void {
  const session = sessions.get(id)
  if (!session) return
  try {
    session.kill()
  } catch {
    /* ignore */
  }
  sessions.delete(id)
}

export function registerTerminalIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(
    AppIpcChannels.terminalCreate,
    (_event, { id, cwd, cols, rows }: { id: string; cwd: string; cols: number; rows: number }) => {
      try {
        killSession(id)
        const shell = defaultShell()
        const session = pty.spawn(shell, [], {
          name: 'xterm-256color',
          cols,
          rows,
          cwd,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
          } as Record<string, string>,
        })
        session.onData((data) => {
          getWindow()?.webContents.send(AppIpcChannels.terminalData, { id, data })
        })
        session.onExit(({ exitCode }) => {
          getWindow()?.webContents.send(AppIpcChannels.terminalExit, { id, exitCode })
          sessions.delete(id)
        })
        sessions.set(id, session)
        return { ok: true }
      } catch {
        return { ok: false }
      }
    },
  )

  ipcMain.handle(AppIpcChannels.terminalWrite, (_event, { id, data }: { id: string; data: string }) => {
    sessions.get(id)?.write(data)
  })

  ipcMain.handle(
    AppIpcChannels.terminalResize,
    (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
      try {
        sessions.get(id)?.resize(cols, rows)
      } catch {
        /* ignore */
      }
    },
  )

  ipcMain.handle(AppIpcChannels.terminalKill, (_event, { id }: { id: string }) => {
    killSession(id)
  })
}

export function killAllTerminalSessions(): void {
  for (const id of [...sessions.keys()]) killSession(id)
}
