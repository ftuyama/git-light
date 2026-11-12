import type { WorkingTreeFile } from '@/types/git'

/** Keys that move the file selection inside a file list (path or tree view). */
export const FILE_NAV_KEYS = ['arrowdown', 'arrowup', 'home', 'end', 'j', 'k'] as const

export type FileNavKey = (typeof FILE_NAV_KEYS)[number]

/** Normalize keys the same way the shortcut registry does (see `normalizeKey`). */
export function isFileNavKey(key: string): key is FileNavKey {
  return (FILE_NAV_KEYS as readonly string[]).includes(key.toLowerCase())
}

/**
 * Index to select after a navigation key, given the files in display order.
 *
 * `currentIndex` is -1 when this list has no selected file yet: ArrowDown
 * (or j) starts at the top, ArrowUp (or k) starts at the bottom, so the first
 * keypress always lands on a file instead of doing nothing.
 *
 * Returns `null` when the key is not a navigation key. The result is clamped
 * (no wrap-around), so holding a key stops at the list edges.
 */
export function fileNavTargetIndex(
  currentIndex: number,
  count: number,
  key: string,
): number | null {
  if (!isFileNavKey(key)) return null
  if (count === 0) return null
  const last = count - 1
  switch (key.toLowerCase()) {
    case 'arrowdown':
    case 'j':
      return currentIndex < 0 ? 0 : Math.min(last, currentIndex + 1)
    case 'arrowup':
    case 'k':
      return currentIndex < 0 ? last : Math.max(0, currentIndex - 1)
    case 'home':
      return 0
    case 'end':
      return last
    default:
      return null
  }
}

/** Index of the followed file in `files`, or -1 when none is selected from this list. */
export function selectedFileIndex(
  files: WorkingTreeFile[],
  path: string | null,
  staged: boolean | null,
): number {
  if (path == null) return -1
  return files.findIndex((file) => file.path === path && file.staged === staged)
}

/** Navigation keys never combine with modifiers; modifier chords stay global shortcuts. */
export function isPlainFileNavEvent(event: KeyboardEvent): boolean {
  return !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
}
