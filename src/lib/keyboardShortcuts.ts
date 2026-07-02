/** Central registry of keyboard shortcuts for the cheatsheet and shortcut handlers. */
export interface ShortcutEntry {
  keys: string
  description: string
  /** When true, only shown in Advanced mode. */
  advanced?: boolean
}

export const KEYBOARD_SHORTCUTS: ShortcutEntry[] = [
  { keys: '⌘F', description: 'Focus branch sidebar search' },
  { keys: '⌘⇧F', description: 'Open global search' },
  { keys: '⌘R', description: 'Refresh repository' },
  { keys: '⌘⇧L', description: 'Pull' },
  { keys: '⌘⇧P', description: 'Push' },
  { keys: '⌘Z', description: 'Undo last operation' },
  { keys: '⌘⇧Z', description: 'Redo operation' },
  { keys: '⌘B', description: 'Toggle left sidebar' },
  { keys: '↑ / ↓ / J / K', description: 'Navigate commit graph' },
  { keys: '⌘T', description: 'Toggle integrated terminal', advanced: true },
]
