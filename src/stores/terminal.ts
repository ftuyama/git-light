import { defineStore } from 'pinia'

const HEIGHT_KEY = 'git-light:terminal-height'
export const TERMINAL_MIN_HEIGHT = 15
export const TERMINAL_MAX_HEIGHT = 70
const DEFAULT_HEIGHT = 32

function clampHeight(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_HEIGHT
  return Math.min(TERMINAL_MAX_HEIGHT, Math.max(TERMINAL_MIN_HEIGHT, value))
}

function readHeight(): number {
  try {
    const raw = localStorage.getItem(HEIGHT_KEY)
    return raw == null ? DEFAULT_HEIGHT : clampHeight(Number(raw))
  } catch {
    return DEFAULT_HEIGHT
  }
}

function persistHeight(value: number): void {
  try {
    localStorage.setItem(HEIGHT_KEY, String(value))
  } catch {
    /* ignore */
  }
}

/** State for the embedded terminal docked under the commit graph. */
export const useTerminalStore = defineStore('terminal', {
  state: () => ({
    open: false,
    /** Percentage of the graph column taken by the terminal pane. */
    height: readHeight(),
  }),
  actions: {
    setOpen(value: boolean): void {
      this.open = value
    },
    toggle(): void {
      this.open = !this.open
    },
    setHeight(value: number): void {
      this.height = clampHeight(value)
      persistHeight(this.height)
    },
  },
})
