import type { FileStatus } from '@/types/git'

interface StatusMeta {
  letter: string
  label: string
  color: string
  bg: string
}

export const STATUS_META: Record<FileStatus, StatusMeta> = {
  modified: {
    letter: 'M',
    label: 'Modified',
    color: 'var(--color-warning)',
    bg: 'color-mix(in srgb, var(--color-warning) 18%, transparent)',
  },
  added: {
    letter: 'A',
    label: 'Added',
    color: 'var(--color-success)',
    bg: 'color-mix(in srgb, var(--color-success) 18%, transparent)',
  },
  deleted: {
    letter: 'D',
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
    letter: '?',
    label: 'Untracked',
    color: 'var(--color-fg-muted)',
    bg: 'color-mix(in srgb, var(--color-fg-muted) 12%, transparent)',
  },
  ignored: {
    letter: 'I',
    label: 'Ignored',
    color: 'var(--color-fg-subtle)',
    bg: 'transparent',
  },
}

export const STATUS_ORDER: FileStatus[] = ['modified', 'added', 'deleted', 'renamed', 'conflicted']
