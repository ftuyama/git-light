import type { Component } from 'vue'
import { Minus, Pencil, Plus } from '@lucide/vue'
import { translate } from '@/locales'
import type { FileStatus, WorkingTreeFile } from '@/types/git'

interface StatusMeta {
  letter: string
  icon?: Component
  /** Translated lazily so the badge follows the active locale. */
  readonly label: string
  color: string
  bg: string
}

export const STATUS_META: Record<FileStatus, StatusMeta> = {
  modified: {
    letter: 'M',
    icon: Pencil,
    get label() {
      return translate('workingTree.status.modified')
    },
    color: 'var(--color-warning)',
    bg: 'color-mix(in srgb, var(--color-warning) 18%, transparent)',
  },
  added: {
    letter: 'A',
    icon: Plus,
    get label() {
      return translate('workingTree.status.added')
    },
    color: 'var(--color-success)',
    bg: 'color-mix(in srgb, var(--color-success) 18%, transparent)',
  },
  deleted: {
    letter: 'D',
    icon: Minus,
    get label() {
      return translate('workingTree.status.deleted')
    },
    color: 'var(--color-danger)',
    bg: 'color-mix(in srgb, var(--color-danger) 18%, transparent)',
  },
  renamed: {
    letter: 'R',
    get label() {
      return translate('workingTree.status.renamed')
    },
    color: 'var(--color-info)',
    bg: 'color-mix(in srgb, var(--color-info) 18%, transparent)',
  },
  conflicted: {
    letter: '!',
    get label() {
      return translate('workingTree.status.conflicted')
    },
    color: 'var(--color-danger)',
    bg: 'color-mix(in srgb, var(--color-danger) 24%, transparent)',
  },
  copied: {
    letter: 'C',
    get label() {
      return translate('workingTree.status.copied')
    },
    color: 'var(--color-info)',
    bg: 'color-mix(in srgb, var(--color-info) 18%, transparent)',
  },
  untracked: {
    letter: 'A',
    icon: Plus,
    get label() {
      return translate('workingTree.status.added')
    },
    color: 'var(--color-success)',
    bg: 'color-mix(in srgb, var(--color-success) 18%, transparent)',
  },
  ignored: {
    letter: 'I',
    get label() {
      return translate('workingTree.status.ignored')
    },
    color: 'var(--color-fg-subtle)',
    bg: 'transparent',
  },
}

export const STATUS_ORDER: FileStatus[] = ['modified', 'added', 'untracked', 'deleted', 'renamed', 'conflicted']

/** Display order shared by the file lists and keyboard navigation: status, then path. */
export function sortFilesForDisplay(files: WorkingTreeFile[]): WorkingTreeFile[] {
  return [...files].sort((a, b) => {
    const byStatus = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    return byStatus !== 0 ? byStatus : a.path.localeCompare(b.path)
  })
}

export interface FileStatusGroup {
  status: FileStatus
  count: number
}

/**
 * Group files into the display-order status summary used by the working tree
 * and commit rows. Untracked files count as added.
 */
export function groupFileStatuses(files: { status: FileStatus }[]): FileStatusGroup[] {
  const counts = new Map<FileStatus, number>()
  for (const file of files) {
    counts.set(file.status, (counts.get(file.status) ?? 0) + 1)
  }
  const added = (counts.get('added') ?? 0) + (counts.get('untracked') ?? 0)
  const groups: FileStatusGroup[] = []
  const push = (status: FileStatus, count: number | undefined) => {
    if (count) groups.push({ status, count })
  }
  push('modified', counts.get('modified'))
  push('added', added)
  push('deleted', counts.get('deleted'))
  push('renamed', counts.get('renamed'))
  push('copied', counts.get('copied'))
  push('conflicted', counts.get('conflicted'))
  push('ignored', counts.get('ignored'))
  return groups
}
