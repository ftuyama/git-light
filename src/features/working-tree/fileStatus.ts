import type { Component } from 'vue'
import { Minus, Pencil, Plus } from '@lucide/vue'
import { translate } from '@/locales'
import type { FileStatus } from '@/types/git'

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
