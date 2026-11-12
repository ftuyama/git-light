import { COMMAND_IDS, COMMAND_META } from '@/lib/keybindings'
import {
  ADVANCED_SECTION_KEYS,
  SECTION_KEYS,
  SECTION_LABELS,
  type SectionKey,
} from '@/lib/preferences'

// Searchable catalog for the settings dialog. Entries mirror the rows rendered in
// AppSettingsDialog.vue: keep labels and descriptions in sync when adding a setting,
// and set `anchor` to the DOM id of the row so search results can scroll to it.

export type SettingsCategory =
  | 'appearance'
  | 'layout'
  | 'changes'
  | 'commits'
  | 'commit-graph'
  | 'sidebar'
  | 'sync'
  | 'shortcuts'
  | 'credits'

export const SETTINGS_CATEGORY_LABELS: Record<SettingsCategory, string> = {
  appearance: 'Appearance',
  layout: 'Layout',
  changes: 'Changes',
  commits: 'Commits',
  'commit-graph': 'Commit Graph',
  sidebar: 'Sidebar',
  sync: 'Sync',
  shortcuts: 'Shortcuts',
  credits: 'Credits',
}

export interface SettingsSearchEntry {
  id: string
  category: SettingsCategory
  label: string
  description?: string
  /** DOM id of the row to scroll to and highlight after navigating. */
  anchor?: string
  keywords?: string[]
  advanced?: boolean
}

export interface SettingsSearchGroup {
  category: SettingsCategory
  label: string
  entries: SettingsSearchEntry[]
}

const SECTION_DESCRIPTIONS: Partial<Record<SectionKey, string>> = {
  favorites: 'Pinned branches shown at the top of the sidebar.',
  localBranches: 'Local branch list and branch groups.',
  remoteBranches: 'Remote-tracking branches grouped by remote.',
  tags: 'Annotated and lightweight tags in the repository.',
  stashes: 'Saved stashes with message and branch context.',
  worktrees: 'Linked worktrees and their checkout paths.',
}

const BASE_ENTRIES: SettingsSearchEntry[] = [
  {
    id: 'interface-mode',
    category: 'appearance',
    label: 'Interface mode',
    description:
      'Basic hides advanced actions like stash, rebase, and terminal. Advanced shows everything.',
    anchor: 'settings-interface-mode',
    keywords: ['basic', 'advanced', 'expert'],
  },
  {
    id: 'theme',
    category: 'appearance',
    label: 'Color theme',
    description: 'Choose a color palette for the application interface.',
    anchor: 'settings-theme',
    keywords: ['palette', 'dark', 'light', 'colors'],
  },
  {
    id: 'remote-avatars',
    category: 'appearance',
    label: 'Author avatars',
    description:
      'Load GitHub and Gravatar images for commit authors. Turn off to show initials only and send no avatar requests.',
    anchor: 'settings-remote-avatars',
    keywords: ['gravatar', 'github', 'images'],
  },
  {
    id: 'avatar-cache',
    category: 'appearance',
    label: 'Clear avatar cache',
    description: 'Forget cached GitHub logins and failed lookups, then resolve avatars again.',
    anchor: 'settings-avatar-cache',
    keywords: ['gravatar', 'github'],
  },
  {
    id: 'left-sidebar',
    category: 'layout',
    label: 'Show Left Sidebar',
    description: 'Display the branch sidebar on the left.',
    anchor: 'settings-left-sidebar',
    keywords: ['panel', 'branches'],
  },
  {
    id: 'right-panel',
    category: 'layout',
    label: 'Show Right Panel',
    description: 'Display the working tree and diff panel on the right.',
    anchor: 'settings-right-panel',
    keywords: ['panel', 'diff', 'working tree'],
  },
  {
    id: 'reset-layout',
    category: 'layout',
    label: 'Reset Panel Layout',
    description: 'Restore default panel sizes and expand both side panels.',
    anchor: 'settings-reset-layout',
    keywords: ['restore', 'default'],
  },
  {
    id: 'tree-view',
    category: 'changes',
    label: 'Tree view',
    description: 'Group changed files in a collapsible folder hierarchy.',
    anchor: 'settings-tree-view',
    keywords: ['files', 'folders', 'working tree'],
  },
  {
    id: 'sign-off',
    category: 'commits',
    label: 'Sign off commit',
    description: 'Add a Signed-off-by trailer to commit messages (--signoff).',
    anchor: 'settings-sign-off',
    keywords: ['signoff', 'trailer'],
  },
  {
    id: 'sign-commit',
    category: 'commits',
    label: 'Sign commit (GPG/SSH)',
    description: 'Sign with GPG/SSH key (-S). Requires user.signingkey in git config.',
    anchor: 'settings-sign-commit',
    keywords: ['gpg', 'ssh', 'signing', 'signingkey'],
  },
  {
    id: 'graph-scope',
    category: 'commit-graph',
    label: 'Show all branches',
    description: 'Display commits from every branch, not just the checked-out branch.',
    anchor: 'settings-graph-scope',
    keywords: ['history', 'scope'],
  },
  {
    id: 'graph-limit',
    category: 'commit-graph',
    label: 'Recent commits to load',
    description: 'Maximum number of commits fetched for the graph.',
    anchor: 'settings-graph-limit',
    keywords: ['history', 'limit', 'maximum'],
  },
  {
    id: 'column-author',
    category: 'commit-graph',
    label: 'Author column',
    description: 'Show the commit author avatar and name in each row.',
    anchor: 'settings-column-author',
    keywords: ['username', 'avatar'],
  },
  {
    id: 'column-sha',
    category: 'commit-graph',
    label: 'SHA column',
    description: 'Show the abbreviated commit hash in each row.',
    anchor: 'settings-column-sha',
    keywords: ['hash', 'abbreviated'],
  },
  {
    id: 'column-when',
    category: 'commit-graph',
    label: 'When column',
    description: 'Show how long ago each commit was made.',
    anchor: 'settings-column-when',
    keywords: ['date', 'time', 'age'],
  },
  {
    id: 'time-markers',
    category: 'commit-graph',
    label: 'Time indicators',
    description: 'Show dividers like “a week ago” between commits in the graph.',
    anchor: 'settings-time-markers',
    keywords: ['markers', 'date', 'dividers'],
  },
  {
    id: 'merge-indicators',
    category: 'commit-graph',
    label: 'Merge indicators',
    description: 'Mark merge commits with a merge icon in the commit message column.',
    anchor: 'settings-merge-indicators',
    keywords: ['merge commits', 'icon'],
  },
  {
    id: 'column-widths',
    category: 'commit-graph',
    label: 'Column widths',
    description: 'Exact pixel widths, or drag the column edges in the graph header.',
    anchor: 'settings-column-widths',
    keywords: ['resize', 'pixels', 'graph header'],
  },
  {
    id: 'auto-fetch',
    category: 'sync',
    label: 'Auto-fetch interval',
    description: 'Silently fetch all remotes on a schedule. No banner, no toast — the graph just updates.',
    anchor: 'settings-auto-fetch',
    keywords: ['background fetch', 'remote', 'schedule', 'poll'],
  },
  {
    id: 'credits',
    category: 'credits',
    label: 'Credits and version',
    description: 'App version, author links and third-party credits.',
    anchor: 'settings-credits',
    keywords: ['about', 'version', 'license', 'links'],
  },
]

const SIDEBAR_ENTRIES: SettingsSearchEntry[] = SECTION_KEYS.map((key) => ({
  id: `sidebar-${key}`,
  category: 'sidebar',
  label: SECTION_LABELS[key],
  description: SECTION_DESCRIPTIONS[key],
  anchor: `settings-sidebar-${key}`,
  keywords: ['sidebar', 'section', 'expanded', 'collapsed', 'hidden'],
  advanced: ADVANCED_SECTION_KEYS.includes(key as (typeof ADVANCED_SECTION_KEYS)[number]),
}))

export function buildSettingsSearchEntries(options: { isAdvanced: boolean }): SettingsSearchEntry[] {
  const entries = [...BASE_ENTRIES, ...SIDEBAR_ENTRIES].filter(
    (entry) => options.isAdvanced || !entry.advanced,
  )

  for (const id of COMMAND_IDS) {
    const meta = COMMAND_META[id]
    if (meta.advanced && !options.isAdvanced) continue
    entries.push({
      id: `shortcut-${id}`,
      category: 'shortcuts',
      label: meta.title,
      description: `Shortcut · ${meta.category}`,
      anchor: `settings-shortcut-${id}`,
      keywords: ['shortcut', 'keybinding', 'keyboard', 'keys'],
      advanced: meta.advanced,
    })
  }

  return entries
}

export function normalizeSettingsQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function searchSettings(
  entries: readonly SettingsSearchEntry[],
  query: string,
): SettingsSearchGroup[] {
  const terms = normalizeSettingsQuery(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []

  const groups = new Map<SettingsCategory, SettingsSearchEntry[]>()

  for (const entry of entries) {
    const haystack = normalizeSettingsQuery(
      [
        entry.label,
        entry.description ?? '',
        SETTINGS_CATEGORY_LABELS[entry.category],
        ...(entry.keywords ?? []),
      ].join(' '),
    )
    if (!terms.every((term) => haystack.includes(term))) continue

    const list = groups.get(entry.category) ?? []
    list.push(entry)
    groups.set(entry.category, list)
  }

  return [...groups.entries()].map(([category, list]) => ({
    category,
    label: SETTINGS_CATEGORY_LABELS[category],
    entries: list,
  }))
}
