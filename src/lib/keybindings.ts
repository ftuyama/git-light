/** Central keybinding registry: every shortcut is remappable and persisted. */

export interface KeyBinding {
  /** Normalized lowercase key, e.g. 'f', 'tab', 'arrowdown', '1', '='. */
  key: string
  /** True = Cmd on macOS / Ctrl elsewhere. */
  ctrlMeta: boolean
  shift: boolean
  alt: boolean
}

export const COMMAND_IDS = [
  'focusSidebarSearch',
  'globalSearch',
  'commandPalette',
  'refresh',
  'pull',
  'push',
  'undo',
  'redo',
  'openTerminal',
  'toggleLeftSidebar',
  'graphZoomIn',
  'graphZoomOut',
  'graphZoomReset',
  'graphNavDown',
  'graphNavUp',
  'nextTab',
  'prevTab',
  'switchTab1',
  'switchTab2',
  'switchTab3',
  'switchTab4',
  'switchTab5',
  'switchTab6',
  'switchTab7',
  'switchTab8',
  'switchTabLast',
  'newTab',
  'closeTab',
  'reopenClosedTab',
] as const

export type CommandId = (typeof COMMAND_IDS)[number]

export interface CommandMeta {
  title: string
  category: 'General' | 'Repository' | 'Tabs' | 'Graph' | 'View'
  allowInInput: boolean
  advanced?: boolean
}

export const COMMAND_META: Record<CommandId, CommandMeta> = {
  focusSidebarSearch: { title: 'Focus branch sidebar search', category: 'General', allowInInput: false },
  globalSearch: { title: 'Open global search', category: 'General', allowInInput: false },
  commandPalette: { title: 'Command palette', category: 'General', allowInInput: true },
  refresh: { title: 'Refresh repository', category: 'Repository', allowInInput: false },
  pull: { title: 'Pull', category: 'Repository', allowInInput: false },
  push: { title: 'Push', category: 'Repository', allowInInput: false },
  undo: { title: 'Undo last operation', category: 'Repository', allowInInput: false },
  redo: { title: 'Redo operation', category: 'Repository', allowInInput: false },
  openTerminal: { title: 'Open system terminal', category: 'Repository', allowInInput: false, advanced: true },
  toggleLeftSidebar: { title: 'Toggle left sidebar', category: 'View', allowInInput: false },
  graphZoomIn: { title: 'Zoom in commit graph', category: 'View', allowInInput: false },
  graphZoomOut: { title: 'Zoom out commit graph', category: 'View', allowInInput: false },
  graphZoomReset: { title: 'Reset graph zoom to 100%', category: 'View', allowInInput: false },
  graphNavDown: { title: 'Next commit in graph', category: 'Graph', allowInInput: false },
  graphNavUp: { title: 'Previous commit in graph', category: 'Graph', allowInInput: false },
  nextTab: { title: 'Next repository tab', category: 'Tabs', allowInInput: true },
  prevTab: { title: 'Previous repository tab', category: 'Tabs', allowInInput: true },
  switchTab1: { title: 'Switch to tab 1', category: 'Tabs', allowInInput: true },
  switchTab2: { title: 'Switch to tab 2', category: 'Tabs', allowInInput: true },
  switchTab3: { title: 'Switch to tab 3', category: 'Tabs', allowInInput: true },
  switchTab4: { title: 'Switch to tab 4', category: 'Tabs', allowInInput: true },
  switchTab5: { title: 'Switch to tab 5', category: 'Tabs', allowInInput: true },
  switchTab6: { title: 'Switch to tab 6', category: 'Tabs', allowInInput: true },
  switchTab7: { title: 'Switch to tab 7', category: 'Tabs', allowInInput: true },
  switchTab8: { title: 'Switch to tab 8', category: 'Tabs', allowInInput: true },
  switchTabLast: { title: 'Switch to last tab (9)', category: 'Tabs', allowInInput: true },
  newTab: { title: 'Open repository (new tab)', category: 'Tabs', allowInInput: true },
  closeTab: { title: 'Close current tab', category: 'Tabs', allowInInput: true },
  reopenClosedTab: { title: 'Reopen closed tab', category: 'Tabs', allowInInput: true },
}

export type Keymap = Record<CommandId, KeyBinding[]>

function b(key: string, opts?: Partial<Omit<KeyBinding, 'key'>>): KeyBinding {
  return {
    key: normalizeKey(key),
    ctrlMeta: opts?.ctrlMeta ?? false,
    shift: opts?.shift ?? false,
    alt: opts?.alt ?? false,
  }
}

export function defaultKeymap(): Keymap {
  const M = { ctrlMeta: true }
  return {
    focusSidebarSearch: [b('f', M)],
    globalSearch: [b('f', { ...M, shift: true })],
    commandPalette: [b('k', M)],
    refresh: [b('r', M)],
    pull: [b('l', { ...M, shift: true })],
    push: [b('p', { ...M, shift: true })],
    undo: [b('z', M)],
    redo: [b('z', { ...M, shift: true })],
    openTerminal: [b('j', M)],
    toggleLeftSidebar: [b('b', M)],
    graphZoomIn: [b('=', M), b('+', M)],
    graphZoomOut: [b('-', M)],
    graphZoomReset: [b('0', M)],
    graphNavDown: [b('arrowdown'), b('j')],
    graphNavUp: [b('arrowup'), b('k')],
    nextTab: [b('tab', M)],
    prevTab: [b('tab', { ...M, shift: true })],
    switchTab1: [b('1', M)],
    switchTab2: [b('2', M)],
    switchTab3: [b('3', M)],
    switchTab4: [b('4', M)],
    switchTab5: [b('5', M)],
    switchTab6: [b('6', M)],
    switchTab7: [b('7', M)],
    switchTab8: [b('8', M)],
    switchTabLast: [b('9', M)],
    newTab: [b('t', M)],
    closeTab: [b('w', M)],
    reopenClosedTab: [b('t', { ...M, shift: true })],
  }
}

/** Normalize KeyboardEvent.key to our canonical token. */
export function normalizeKey(key: string): string {
  if (key === ' ') return 'space'
  const lower = key.toLowerCase()
  // Single printable chars stay as-is; named keys already lowercase.
  if (lower === 'tab' || lower === 'space') return lower
  if (lower.startsWith('arrow')) return lower
  if (lower === 'escape' || lower === 'enter' || lower === 'backspace' || lower === 'delete') return lower
  return lower
}

export function isValidKeyBinding(value: unknown): value is KeyBinding {
  if (typeof value !== 'object' || value == null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['key'] === 'string' &&
    (v['key'] as string).length > 0 &&
    (v['key'] as string).length <= 20 &&
    typeof v['ctrlMeta'] === 'boolean' &&
    typeof v['shift'] === 'boolean' &&
    typeof v['alt'] === 'boolean'
  )
}

/** Merge a persisted keymap with defaults; unknown ids dropped, invalid entries fall back. */
export function sanitizeKeymap(saved: unknown): Keymap {
  const defaults = defaultKeymap()
  if (typeof saved !== 'object' || saved == null) return defaults
  const out = { ...defaults } as Keymap
  const record = saved as Record<string, unknown>
  for (const id of COMMAND_IDS) {
    const raw = record[id]
    if (raw === undefined) continue
    const list = Array.isArray(raw) ? raw : [raw]
    const clean: KeyBinding[] = []
    for (const item of list) {
      if (!isValidKeyBinding(item)) continue
      clean.push({
        key: normalizeKey(item.key),
        ctrlMeta: item.ctrlMeta,
        shift: item.shift,
        alt: item.alt,
      })
    }
    // Empty array = explicitly disabled; keep it. Invalid non-array falls back.
    if (Array.isArray(raw)) out[id] = clean
    else if (clean.length > 0) out[id] = clean
  }
  return out
}

export function bindingSignature(binding: KeyBinding): string {
  return `${binding.key}|${binding.ctrlMeta ? 1 : 0}|${binding.shift ? 1 : 0}|${binding.alt ? 1 : 0}`
}

export function bindingsEqual(a: KeyBinding, c: KeyBinding): boolean {
  return bindingSignature(a) === bindingSignature(c)
}

/** All commands bound to a given signature, for conflict display. */
export function findConflicts(keymap: Keymap): Map<string, CommandId[]> {
  const bySignature = new Map<string, CommandId[]>()
  for (const id of COMMAND_IDS) {
    for (const binding of keymap[id] ?? []) {
      const sig = bindingSignature(binding)
      const list = bySignature.get(sig) ?? []
      list.push(id)
      bySignature.set(sig, list)
    }
  }
  const conflicts = new Map<string, CommandId[]>()
  for (const [sig, ids] of bySignature) {
    if (ids.length > 1) conflicts.set(sig, ids)
  }
  return conflicts
}

export function matchesBinding(binding: KeyBinding, event: KeyboardEvent): boolean {
  if (normalizeKey(event.key) !== binding.key) return false
  const meta = event.metaKey || event.ctrlKey
  if (binding.ctrlMeta !== meta) return false
  if (binding.shift !== event.shiftKey) return false
  if (binding.alt !== event.altKey) return false
  return true
}

export function eventToBinding(event: KeyboardEvent): KeyBinding {
  return {
    key: normalizeKey(event.key),
    ctrlMeta: event.metaKey || event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey,
  }
}

function isMac(): boolean {
  if (typeof navigator === 'undefined') return true
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? ''
  return /mac/i.test(platform)
}

/** Single binding label, e.g. ⌘⇧T / Ctrl+Shift+T. */
export function formatBinding(binding: KeyBinding, mac?: boolean): string {
  const useMac = mac ?? isMac()
  const keyLabel = prettyKey(binding.key, useMac)
  if (useMac) {
    return `${binding.ctrlMeta ? '⌘' : ''}${binding.alt ? '⌥' : ''}${binding.shift ? '⇧' : ''}${keyLabel}`
  }
  const parts: string[] = []
  if (binding.ctrlMeta) parts.push('Ctrl')
  if (binding.alt) parts.push('Alt')
  if (binding.shift) parts.push('Shift')
  parts.push(keyLabel)
  return parts.join('+')
}

function prettyKey(key: string, useMac: boolean): string {
  void useMac
  const map: Record<string, string> = {
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    space: 'Space',
    tab: 'Tab',
    escape: 'Esc',
    enter: '↵',
    backspace: '⌫',
    delete: '⌦',
  }
  if (map[key]) return map[key]
  if (key === '+' || key === '=' || key === '-' || key === '0') return key
  return key.length === 1 ? key.toUpperCase() : key
}

/** Join all bindings for a command, e.g. "⌘= / ⌘+". Empty = "—". */
export function formatBindings(bindings: KeyBinding[], mac?: boolean): string {
  if (bindings.length === 0) return '—'
  return bindings.map((x) => formatBinding(x, mac)).join(' / ')
}
