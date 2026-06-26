import { contextBridge, ipcRenderer } from 'electron'
import { AppIpcChannels, type AppIpcContract } from '@shared/app/ipc'
import { IpcChannels, type IpcContract } from '@shared/git/ipc'
import type { OperationProgress, RepoChangeEvent } from '@shared/git/models'

function invokeGit<K extends keyof IpcContract>(
  channel: K,
  ...args: IpcContract[K] extends [infer Req, unknown] ? (Req extends void ? [] : [Req]) : never
): Promise<IpcContract[K] extends [unknown, infer Res] ? Res : never> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcContract[K] extends [unknown, infer Res] ? Res : never>
}

function invokeApp<K extends keyof AppIpcContract>(
  channel: K,
  ...args: AppIpcContract[K] extends [infer Req, unknown] ? (Req extends void ? [] : [Req]) : never
): Promise<AppIpcContract[K] extends [unknown, infer Res] ? Res : never> {
  return ipcRenderer.invoke(channel, ...args) as Promise<AppIpcContract[K] extends [unknown, infer Res] ? Res : never>
}

const git = {
  recentRepos: () => invokeGit(IpcChannels.recentRepos),
  removeRecent: (req: IpcContract[typeof IpcChannels.removeRecent][0]) =>
    invokeGit(IpcChannels.removeRecent, req),
  openRepo: (req: IpcContract[typeof IpcChannels.openRepo][0]) => invokeGit(IpcChannels.openRepo, req),
  pickAndOpenRepo: (req: IpcContract[typeof IpcChannels.pickAndOpenRepo][0]) =>
    invokeGit(IpcChannels.pickAndOpenRepo, req),
  closeRepo: () => invokeGit(IpcChannels.closeRepo),
  snapshot: (req: IpcContract[typeof IpcChannels.snapshot][0]) => invokeGit(IpcChannels.snapshot, req),
  commitPage: (req: IpcContract[typeof IpcChannels.commitPage][0]) =>
    invokeGit(IpcChannels.commitPage, req),
  action: (req: IpcContract[typeof IpcChannels.action][0]) => invokeGit(IpcChannels.action, req),
  diff: (req: IpcContract[typeof IpcChannels.diff][0]) => invokeGit(IpcChannels.diff, req),
  conflict: (req: IpcContract[typeof IpcChannels.conflict][0]) =>
    invokeGit(IpcChannels.conflict, req),
  commitFiles: (req: IpcContract[typeof IpcChannels.commitFiles][0]) =>
    invokeGit(IpcChannels.commitFiles, req),
  compareFiles: (req: IpcContract[typeof IpcChannels.compareFiles][0]) =>
    invokeGit(IpcChannels.compareFiles, req),
  search: (req: IpcContract[typeof IpcChannels.search][0]) => invokeGit(IpcChannels.search, req),
  rebaseCommits: (req: IpcContract[typeof IpcChannels.rebaseCommits][0]) =>
    invokeGit(IpcChannels.rebaseCommits, req),
  cancel: () => invokeGit(IpcChannels.cancel),
  openTerminal: (req: IpcContract[typeof IpcChannels.openTerminal][0]) =>
    invokeGit(IpcChannels.openTerminal, req),
  revealPath: (req: IpcContract[typeof IpcChannels.revealPath][0]) =>
    invokeGit(IpcChannels.revealPath, req),
  onChanged(cb: (event: RepoChangeEvent) => void): () => void {
    const handler = (_: Electron.IpcRendererEvent, event: RepoChangeEvent) => cb(event)
    ipcRenderer.on(IpcChannels.changed, handler)
    return () => ipcRenderer.off(IpcChannels.changed, handler)
  },
  onProgress(cb: (progress: OperationProgress) => void): () => void {
    const handler = (_: Electron.IpcRendererEvent, progress: OperationProgress) => cb(progress)
    ipcRenderer.on(IpcChannels.progress, handler)
    return () => ipcRenderer.off(IpcChannels.progress, handler)
  },
}

const terminal = {
  create(req: AppIpcContract[typeof AppIpcChannels.terminalCreate][0]) {
    return invokeApp(AppIpcChannels.terminalCreate, req)
  },
  write(req: AppIpcContract[typeof AppIpcChannels.terminalWrite][0]) {
    return invokeApp(AppIpcChannels.terminalWrite, req)
  },
  resize(req: AppIpcContract[typeof AppIpcChannels.terminalResize][0]) {
    return invokeApp(AppIpcChannels.terminalResize, req)
  },
  kill(req: AppIpcContract[typeof AppIpcChannels.terminalKill][0]) {
    return invokeApp(AppIpcChannels.terminalKill, req)
  },
  onData(cb: (payload: { id: string; data: string }) => void): () => void {
    const handler = (_: Electron.IpcRendererEvent, payload: { id: string; data: string }) =>
      cb(payload)
    ipcRenderer.on(AppIpcChannels.terminalData, handler)
    return () => ipcRenderer.off(AppIpcChannels.terminalData, handler)
  },
  onExit(cb: (payload: { id: string; exitCode: number }) => void): () => void {
    const handler = (_: Electron.IpcRendererEvent, payload: { id: string; exitCode: number }) =>
      cb(payload)
    ipcRenderer.on(AppIpcChannels.terminalExit, handler)
    return () => ipcRenderer.off(AppIpcChannels.terminalExit, handler)
  },
}

const api = {
  store: {
    get<T>(key: string, fallback: T): Promise<T> {
      return invokeApp(AppIpcChannels.storeGet, { key, fallback }) as Promise<T>
    },
    set(key: string, value: unknown): Promise<void> {
      return invokeApp(AppIpcChannels.storeSet, { key, value })
    },
  },
  git,
  terminal,
  openExternal(url: string): Promise<void> {
    return invokeApp(AppIpcChannels.openExternal, { url })
  },
  setWindowBackgroundColor(color: string): Promise<void> {
    return invokeApp(AppIpcChannels.setWindowBackgroundColor, { color })
  },
  onWindowFocus(cb: () => void): () => void {
    const handler = () => cb()
    ipcRenderer.on(AppIpcChannels.windowFocus, handler)
    return () => ipcRenderer.off(AppIpcChannels.windowFocus, handler)
  },
  onWindowBlur(cb: () => void): () => void {
    const handler = () => cb()
    ipcRenderer.on(AppIpcChannels.windowBlur, handler)
    return () => ipcRenderer.off(AppIpcChannels.windowBlur, handler)
  },
}

contextBridge.exposeInMainWorld('electron', api)

export type ElectronApi = typeof api
