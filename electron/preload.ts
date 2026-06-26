import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type IpcContract } from '@shared/git/ipc'
import type { OperationProgress, RepoChangeEvent } from '@shared/git/models'

function invoke<K extends keyof IpcContract>(
  channel: K,
  ...args: IpcContract[K] extends [infer Req, unknown] ? (Req extends void ? [] : [Req]) : never
): Promise<IpcContract[K] extends [unknown, infer Res] ? Res : never> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcContract[K] extends [unknown, infer Res] ? Res : never>
}

const git = {
  recentRepos: () => invoke(IpcChannels.recentRepos),
  removeRecent: (req: IpcContract[typeof IpcChannels.removeRecent][0]) =>
    invoke(IpcChannels.removeRecent, req),
  openRepo: (req: IpcContract[typeof IpcChannels.openRepo][0]) => invoke(IpcChannels.openRepo, req),
  pickAndOpenRepo: (req: IpcContract[typeof IpcChannels.pickAndOpenRepo][0]) =>
    invoke(IpcChannels.pickAndOpenRepo, req),
  closeRepo: () => invoke(IpcChannels.closeRepo),
  snapshot: (req: IpcContract[typeof IpcChannels.snapshot][0]) => invoke(IpcChannels.snapshot, req),
  commitPage: (req: IpcContract[typeof IpcChannels.commitPage][0]) =>
    invoke(IpcChannels.commitPage, req),
  action: (req: IpcContract[typeof IpcChannels.action][0]) => invoke(IpcChannels.action, req),
  diff: (req: IpcContract[typeof IpcChannels.diff][0]) => invoke(IpcChannels.diff, req),
  conflict: (req: IpcContract[typeof IpcChannels.conflict][0]) =>
    invoke(IpcChannels.conflict, req),
  commitFiles: (req: IpcContract[typeof IpcChannels.commitFiles][0]) =>
    invoke(IpcChannels.commitFiles, req),
  compareFiles: (req: IpcContract[typeof IpcChannels.compareFiles][0]) =>
    invoke(IpcChannels.compareFiles, req),
  search: (req: IpcContract[typeof IpcChannels.search][0]) => invoke(IpcChannels.search, req),
  rebaseCommits: (req: IpcContract[typeof IpcChannels.rebaseCommits][0]) =>
    invoke(IpcChannels.rebaseCommits, req),
  cancel: () => invoke(IpcChannels.cancel),
  openTerminal: (req: IpcContract[typeof IpcChannels.openTerminal][0]) =>
    invoke(IpcChannels.openTerminal, req),
  revealPath: (req: IpcContract[typeof IpcChannels.revealPath][0]) =>
    invoke(IpcChannels.revealPath, req),
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

const api = {
  store: {
    get<T>(key: string, fallback: T): Promise<T> {
      return ipcRenderer.invoke('store:get', key, fallback)
    },
    set(key: string, value: unknown): Promise<void> {
      return ipcRenderer.invoke('store:set', key, value)
    },
  },
  git,
  openExternal(url: string): Promise<void> {
    return ipcRenderer.invoke('app:open-external', url)
  },
  onWindowFocus(cb: () => void): () => void {
    const handler = () => cb()
    ipcRenderer.on('window:focus', handler)
    return () => ipcRenderer.off('window:focus', handler)
  },
  onWindowBlur(cb: () => void): () => void {
    const handler = () => cb()
    ipcRenderer.on('window:blur', handler)
    return () => ipcRenderer.off('window:blur', handler)
  },
}

contextBridge.exposeInMainWorld('electron', api)

export type ElectronApi = typeof api
