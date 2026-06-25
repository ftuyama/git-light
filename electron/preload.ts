import { contextBridge, ipcRenderer } from 'electron'

const api = {
  store: {
    get<T>(key: string, fallback: T): Promise<T> {
      return ipcRenderer.invoke('store:get', key, fallback)
    },
    set(key: string, value: unknown): Promise<void> {
      return ipcRenderer.invoke('store:set', key, value)
    },
  },
  git: {
    action(action: unknown): Promise<{ ok: boolean; action: unknown }> {
      return ipcRenderer.invoke('git:action', action)
    },
  },
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
