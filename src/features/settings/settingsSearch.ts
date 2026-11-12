import { COMMAND_IDS, COMMAND_META, commandCategoryKey } from '@/lib/keybindings'
import { translate } from '@/locales'
import {
  ADVANCED_SECTION_KEYS,
  SECTION_KEYS,
  SECTION_LABEL_KEYS,
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

export const SETTINGS_CATEGORY_KEYS: Record<SettingsCategory, string> = {
  appearance: 'settings.categories.appearance',
  layout: 'settings.categories.layout',
  changes: 'settings.categories.changes',
  commits: 'settings.categories.commits',
  'commit-graph': 'settings.categories.commitGraph',
  sidebar: 'settings.categories.sidebar',
  sync: 'settings.categories.sync',
  shortcuts: 'settings.categories.shortcuts',
  credits: 'settings.categories.credits',
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

/** Source entry: catalog keys stay unresolved so the active locale can apply. */
interface SearchEntrySource {
  id: string
  category: SettingsCategory
  labelKey: string
  descriptionKey?: string
  anchor?: string
  keywords?: string[]
  advanced?: boolean
}

const BASE_ENTRIES: SearchEntrySource[] = [
  {
    id: 'interface-mode',
    category: 'appearance',
    labelKey: 'settings.appearance.interface',
    descriptionKey: 'settings.appearance.interfaceDescription',
    anchor: 'settings-interface-mode',
    keywords: ['basic', 'advanced', 'expert'],
  },
  {
    id: 'theme',
    category: 'appearance',
    labelKey: 'settings.appearance.theme',
    descriptionKey: 'settings.appearance.themeDescription',
    anchor: 'settings-theme',
    keywords: ['palette', 'dark', 'light', 'colors'],
  },
  {
    id: 'remote-avatars',
    category: 'appearance',
    labelKey: 'settings.avatars.authorAvatars',
    descriptionKey: 'settings.avatars.authorAvatarsDescription',
    anchor: 'settings-remote-avatars',
    keywords: ['gravatar', 'github', 'images'],
  },
  {
    id: 'avatar-cache',
    category: 'appearance',
    labelKey: 'settings.avatars.clearCache',
    descriptionKey: 'settings.avatars.clearCacheDescription',
    anchor: 'settings-avatar-cache',
    keywords: ['gravatar', 'github'],
  },
  {
    id: 'language',
    category: 'appearance',
    labelKey: 'settings.language.title',
    descriptionKey: 'settings.language.description',
    anchor: 'settings-language',
    keywords: ['locale', 'translation', 'english', 'portuguese', 'chinese'],
  },
  {
    id: 'left-sidebar',
    category: 'layout',
    labelKey: 'settings.layout.showLeftSidebar',
    descriptionKey: 'settings.layout.showLeftSidebarDescription',
    anchor: 'settings-left-sidebar',
    keywords: ['panel', 'branches'],
  },
  {
    id: 'right-panel',
    category: 'layout',
    labelKey: 'settings.layout.showRightPanel',
    descriptionKey: 'settings.layout.showRightPanelDescription',
    anchor: 'settings-right-panel',
    keywords: ['panel', 'diff', 'working tree'],
  },
  {
    id: 'reset-layout',
    category: 'layout',
    labelKey: 'settings.layout.resetAction',
    descriptionKey: 'settings.layout.resetDescription',
    anchor: 'settings-reset-layout',
    keywords: ['restore', 'default'],
  },
  {
    id: 'tree-view',
    category: 'changes',
    labelKey: 'settings.changes.treeView',
    descriptionKey: 'settings.changes.treeViewDescription',
    anchor: 'settings-tree-view',
    keywords: ['files', 'folders', 'working tree'],
  },
  {
    id: 'sign-off',
    category: 'commits',
    labelKey: 'settings.commits.signOff',
    descriptionKey: 'settings.commits.signOffDescription',
    anchor: 'settings-sign-off',
    keywords: ['signoff', 'trailer'],
  },
  {
    id: 'sign-commit',
    category: 'commits',
    labelKey: 'settings.commits.sign',
    descriptionKey: 'settings.commits.signDescription',
    anchor: 'settings-sign-commit',
    keywords: ['gpg', 'ssh', 'signing', 'signingkey'],
  },
  {
    id: 'graph-scope',
    category: 'commit-graph',
    labelKey: 'settings.commitGraph.showAllBranches',
    descriptionKey: 'settings.commitGraph.showAllBranchesDescription',
    anchor: 'settings-graph-scope',
    keywords: ['history', 'scope'],
  },
  {
    id: 'graph-limit',
    category: 'commit-graph',
    labelKey: 'settings.commitGraph.recentCommits',
    descriptionKey: 'settings.commitGraph.recentCommitsSummary',
    anchor: 'settings-graph-limit',
    keywords: ['history', 'limit', 'maximum'],
  },
  {
    id: 'column-author',
    category: 'commit-graph',
    labelKey: 'settings.search.columnAuthor',
    descriptionKey: 'settings.columnDescriptions.author',
    anchor: 'settings-column-author',
    keywords: ['username', 'avatar'],
  },
  {
    id: 'column-sha',
    category: 'commit-graph',
    labelKey: 'settings.search.columnSha',
    descriptionKey: 'settings.columnDescriptions.sha',
    anchor: 'settings-column-sha',
    keywords: ['hash', 'abbreviated'],
  },
  {
    id: 'column-when',
    category: 'commit-graph',
    labelKey: 'settings.search.columnWhen',
    descriptionKey: 'settings.columnDescriptions.when',
    anchor: 'settings-column-when',
    keywords: ['date', 'time', 'age'],
  },
  {
    id: 'time-markers',
    category: 'commit-graph',
    labelKey: 'settings.commitGraph.timeIndicators',
    descriptionKey: 'settings.commitGraph.timeIndicatorsDescription',
    anchor: 'settings-time-markers',
    keywords: ['markers', 'date', 'dividers'],
  },
  {
    id: 'merge-indicators',
    category: 'commit-graph',
    labelKey: 'settings.commitGraph.mergeIndicators',
    descriptionKey: 'settings.commitGraph.mergeIndicatorsDescription',
    anchor: 'settings-merge-indicators',
    keywords: ['merge commits', 'icon'],
  },
  {
    id: 'column-widths',
    category: 'commit-graph',
    labelKey: 'settings.commitGraph.columnWidths',
    descriptionKey: 'settings.commitGraph.columnWidthsDescription',
    anchor: 'settings-column-widths',
    keywords: ['resize', 'pixels', 'graph header'],
  },
  {
    id: 'auto-fetch',
    category: 'sync',
    labelKey: 'settings.sync.autoFetchInterval',
    descriptionKey: 'settings.sync.autoFetchIntervalDescription',
    anchor: 'settings-auto-fetch',
    keywords: ['background fetch', 'remote', 'schedule', 'poll'],
  },
  {
    id: 'credits',
    category: 'credits',
    labelKey: 'settings.search.credits',
    descriptionKey: 'settings.search.creditsDescription',
    anchor: 'settings-credits',
    keywords: ['about', 'version', 'license', 'links'],
  },
]

const SIDEBAR_ENTRIES: SearchEntrySource[] = SECTION_KEYS.map((key: SectionKey) => ({
  id: `sidebar-${key}`,
  category: 'sidebar',
  labelKey: SECTION_LABEL_KEYS[key],
  descriptionKey: `settings.sectionDescriptions.${key}`,
  anchor: `settings-sidebar-${key}`,
  keywords: ['sidebar', 'section', 'expanded', 'collapsed', 'hidden'],
  advanced: ADVANCED_SECTION_KEYS.includes(key as (typeof ADVANCED_SECTION_KEYS)[number]),
}))

function resolveEntry(source: SearchEntrySource): SettingsSearchEntry {
  return {
    id: source.id,
    category: source.category,
    label: translate(source.labelKey),
    description: source.descriptionKey ? translate(source.descriptionKey) : undefined,
    anchor: source.anchor,
    keywords: source.keywords,
    advanced: source.advanced,
  }
}

export function settingsCategoryLabel(category: SettingsCategory): string {
  return translate(SETTINGS_CATEGORY_KEYS[category])
}

export function buildSettingsSearchEntries(options: { isAdvanced: boolean }): SettingsSearchEntry[] {
  const entries = [...BASE_ENTRIES, ...SIDEBAR_ENTRIES]
    .filter((entry) => options.isAdvanced || !entry.advanced)
    .map(resolveEntry)

  for (const id of COMMAND_IDS) {
    const meta = COMMAND_META[id]
    if (meta.advanced && !options.isAdvanced) continue
    entries.push({
      id: `shortcut-${id}`,
      category: 'shortcuts',
      label: translate(meta.titleKey),
      description: translate('settings.search.shortcutDescription', {
        category: translate(commandCategoryKey(meta.category)),
      }),
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
        settingsCategoryLabel(entry.category),
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
    label: settingsCategoryLabel(category),
    entries: list,
  }))
}
