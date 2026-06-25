import type { ElectronApi } from '../../electron/preload'

declare global {
  interface Window {
    electron: ElectronApi
  }
}

export {}
