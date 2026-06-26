import type { DiffLine } from '@shared/git/models'

export type DiffLineKind = DiffLine['type'] | 'empty'

export function lineBgClass(type: DiffLineKind): string {
  switch (type) {
    case 'add':
      return 'bg-[var(--color-success)]/12'
    case 'del':
      return 'bg-[var(--color-danger)]/12'
    case 'hunk':
      return 'bg-[var(--color-info)]/10'
    case 'empty':
      return 'bg-[var(--color-panel)]/40'
    default:
      return ''
  }
}

export function lineTextClass(type: DiffLineKind): string {
  switch (type) {
    case 'add':
      return 'text-[var(--color-success)]'
    case 'del':
      return 'text-[var(--color-danger)]'
    case 'hunk':
      return 'text-[var(--color-info)] font-medium'
    case 'empty':
      return 'text-transparent'
    default:
      return 'text-[var(--color-fg-muted)]'
  }
}

export function lineClass(type: DiffLineKind): string {
  return [lineBgClass(type), lineTextClass(type)].filter(Boolean).join(' ')
}
