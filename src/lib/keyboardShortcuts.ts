/** Backwards-compatible cheatsheet derived from the remappable keybinding defaults. */
import { COMMAND_IDS, COMMAND_META, defaultKeymap, formatBindings } from './keybindings'

export interface ShortcutEntry {
  keys: string
  description: string
  /** When true, only shown in Advanced mode. */
  advanced?: boolean
}

function buildEntries(): ShortcutEntry[] {
  const defaults = defaultKeymap()
  return COMMAND_IDS.map((id) => ({
    keys: formatBindings(defaults[id]),
    description: COMMAND_META[id].title,
    ...(COMMAND_META[id].advanced ? { advanced: true as const } : {}),
  }))
}

export const KEYBOARD_SHORTCUTS: ShortcutEntry[] = buildEntries()
