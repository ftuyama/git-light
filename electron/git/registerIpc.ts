import { spawn } from 'node:child_process'
import type { BrowserWindow } from 'electron'
import { dialog, ipcMain, shell } from 'electron'
import Store from 'electron-store'
import { IpcChannels } from '@shared/git/ipc'
import type { RecentRepository, RepoChangeEvent } from '@shared/git/models'
import { gitProvider } from './GitProvider'
import { RepositoryWatcher } from './RepositoryWatcher'

const RECENT_KEY = 'recent-repos'
const FAVORITES_PREFIX = 'branch-favorites:'

export function registerGitIpc(getWindow: () => BrowserWindow | null, store: Store): void {
  const watcher = new RepositoryWatcher()

  function notifyChanged(event: RepoChangeEvent): void {
    gitProvider.invalidateCache(event.scopes)
    getWindow()?.webContents.send(IpcChannels.changed, event)
  }

  gitProvider.setHooks({
    getRecent: () => store.get(RECENT_KEY, []) as RecentRepository[],
    setRecent: (list) => store.set(RECENT_KEY, list),
    getFavorites: (repoPath) => new Set(store.get(`${FAVORITES_PREFIX}${repoPath}`, []) as string[]),
    onChanged: notifyChanged,
    onProgress: (progress) => {
      getWindow()?.webContents.send(IpcChannels.progress, progress)
    },
  })

  ipcMain.handle(IpcChannels.recentRepos, () => gitProvider.recentRepos())

  ipcMain.handle(IpcChannels.removeRecent, (_e, { path }) => gitProvider.removeRecent(path))

  ipcMain.handle(IpcChannels.openRepo, async (_e, { path, options }) => {
    await watcher.stop()
    const result = await gitProvider.open(path, options)
    if (result.ok && result.snapshot) {
      await watcher.watch(result.snapshot.repository.path, notifyChanged)
    }
    return result
  })

  ipcMain.handle(IpcChannels.pickAndOpenRepo, async (_e, { options }) => {
    const win = getWindow()
    const dialogOptions = {
      properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[],
      title: 'Open Git Repository',
    }
    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)
    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true as const }
    }
    await watcher.stop()
    const openResult = await gitProvider.open(result.filePaths[0], options)
    if (openResult.ok && openResult.snapshot) {
      await watcher.watch(openResult.snapshot.repository.path, notifyChanged)
    }
    return openResult
  })

  ipcMain.handle(IpcChannels.closeRepo, async () => {
    await watcher.stop()
    gitProvider.close()
  })

  ipcMain.handle(IpcChannels.snapshot, async (_e, { options }) => {
    return gitProvider.snapshot(options)
  })

  ipcMain.handle(IpcChannels.commitPage, async (_e, request) => {
    return gitProvider.loadCommitPage(request)
  })

  ipcMain.handle(IpcChannels.action, async (_e, action) => {
    return gitProvider.execute(action)
  })

  ipcMain.handle(IpcChannels.diff, async (_e, request) => {
    return gitProvider.getDiff(request)
  })

  ipcMain.handle(IpcChannels.conflict, async (_e, request) => {
    return gitProvider.getConflict(request)
  })

  ipcMain.handle(IpcChannels.commitFiles, async (_e, { sha }) => {
    return gitProvider.getCommitFiles(sha)
  })

  ipcMain.handle(IpcChannels.compareFiles, async (_e, { fromSha, toSha }) => {
    return gitProvider.getCompareFiles(fromSha, toSha)
  })

  ipcMain.handle(IpcChannels.search, async (_e, query) => {
    return gitProvider.search(query)
  })

  ipcMain.handle(IpcChannels.rebaseCommits, async (_e, request) => {
    return gitProvider.getRebaseCommits(request)
  })

  ipcMain.handle(IpcChannels.cancel, async () => {
    gitProvider.cancelActive()
  })

  ipcMain.handle(IpcChannels.openTerminal, async (_e, { path }) => {
    const cwd = path ?? gitProvider.currentPath
    if (!cwd) return { ok: false }
    try {
      openTerminal(cwd)
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })

  ipcMain.handle(IpcChannels.revealPath, async (_e, { path }) => {
    shell.showItemInFolder(path)
  })
}

function openTerminal(cwd: string): void {
  if (process.platform === 'darwin') {
    const script = `tell application "Terminal" to do script "cd ${cwd.replace(/"/g, '\\"')}"`
    spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' }).unref()
    return
  }
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/K', `cd /d "${cwd}"`], {
      detached: true,
      stdio: 'ignore',
    }).unref()
    return
  }
  const term = process.env.TERM_PROGRAM ?? 'x-terminal-emulator'
  spawn(term, ['-e', 'bash', '-lc', `cd "${cwd.replace(/"/g, '\\"')}"; exec bash`], {
    detached: true,
    stdio: 'ignore',
  }).unref()
}
