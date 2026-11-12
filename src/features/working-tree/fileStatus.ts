import type { Component } from 'vue'
import { Minus, Pencil, Plus } from '@lucide/vue'
import type { FileStatus } from '@/types/git'

interface StatusMeta {
  letter: string
  icon?: Component
  label: string
  color: string
  bg: string
}

export const STATUS_META: Record<FileStatus, StatusMeta> = {
  modified: {
    letter: 'M',
    icon: Pencil,
    label: 'Modified',
    color: 'var(--color-warning)',
    bg: 'color-mix(in srgb, var(--color-warning) 18%, transparent)',
  },
  added: {
    letter: 'A',
    icon: Plus,
    label: 'Added',
    color: 'var(--color-success)',
    bg: 'color-mix(in srgb, var(--color-success) 18%, transparent)',
  },
  deleted: {
    letter: 'D',
    icon: Minus,
    label: 'Deleted',
    color: 'var(--color-danger)',
    bg: 'color-mix(in srgb, var(--color-danger) 18%, transparent)',
  },
  renamed: {
    letter: 'R',
    label: 'Renamed',
    color: 'var(--color-info)',
    bg: 'color-mix(in srgb, var(--color-info) 18%, transparent)',
  },
  conflicted: {
    letter: '!',
    label: 'Conflicted',
    color: 'var(--color-danger)',
    bg: 'color-mix(in srgb, var(--color-danger) 24%, transparent)',
  },
  copied: {
    letter: 'C',
    label: 'Copied',
    color: 'var(--color-info)',
    bg: 'color-mix(in srgb, var(--color-info) 18%, transparent)',
  },
  untracked: {
    letter: 'A',
    icon: Plus,
    label: 'Added',
    color: 'var(--color-success)',
    bg: 'color-mix(in srgb, var(--color-success) 18%, transparent)',
  },
  ignored: {
    letter: 'I',
    label: 'Ignored',
    color: 'var(--color-fg-subtle)',
    bg: 'transparent',
  },
}

export const STATUS_ORDER: FileStatus[] = ['modified', 'added', 'untracked', 'deleted', 'renamed', 'conflicted']

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
