import { onBeforeUnmount, onMounted } from 'vue'

export interface ShortcutHandler {
  /** Lowercase key, e.g. 'f', 'arrowdown'. */
  key: string
  meta?: boolean
  shift?: boolean
  alt?: boolean
  handler: (event: KeyboardEvent) => void
  /** Allow firing even while focused in an input/textarea. */
  allowInInput?: boolean
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]): void {
  const onKeydown = (event: KeyboardEvent): void => {
    const editable = isEditableTarget(event.target)
    for (const shortcut of shortcuts) {
      if (editable && !shortcut.allowInInput) continue
      if (event.key.toLowerCase() !== shortcut.key) continue
      const meta = event.metaKey || event.ctrlKey
      if (!!shortcut.meta !== meta) continue
      if (!!shortcut.shift !== event.shiftKey) continue
      if (!!shortcut.alt !== event.altKey) continue
      event.preventDefault()
      shortcut.handler(event)
      return
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
