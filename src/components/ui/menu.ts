import type { Component } from 'vue'

export interface MenuItem {
  /** When true, render a divider instead of an actionable row. */
  separator?: boolean
  label?: string
  icon?: Component
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  onSelect?: () => void
  children?: MenuItem[]
}

export const MENU_CONTENT_CLASS =
  'animate-pop z-50 min-w-[200px] overflow-hidden rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-1 shadow-xl shadow-black/50'

export const MENU_ITEM_CLASS =
  'group flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[13px] text-[var(--color-fg)] outline-none select-none data-[highlighted]:bg-[var(--color-accent-strong)] data-[highlighted]:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-40'

export const MENU_ITEM_DANGER_CLASS =
  'group flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[13px] text-[var(--color-danger)] outline-none select-none data-[highlighted]:bg-[var(--color-danger)] data-[highlighted]:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-40'
