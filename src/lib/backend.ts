export type NativeBackend = 'tauri' | 'web'

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
  }
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function currentBackend(): NativeBackend {
  if (isTauri()) return 'tauri'
  return 'web'
}
