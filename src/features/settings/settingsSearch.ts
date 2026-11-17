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
  | 'interface'
  | 'language'
  | 'changes'
  | 'commits'
  | 'commit-graph'
  | 'sidebar'
  | 'sync'
  | 'privacy'
  | 'shortcuts'
  | 'credits'

export const SETTINGS_CATEGORY_KEYS: Record<SettingsCategory, string> = {
  appearance: 'settings.categories.appearance',
  interface: 'settings.categories.interface',
  language: 'settings.categories.language',
  changes: 'settings.categories.changes',
  commits: 'settings.categories.commits',
  'commit-graph': 'settings.categories.commitGraph',
  sidebar: 'settings.categories.sidebar',
  sync: 'settings.categories.sync',
  privacy: 'settings.categories.privacy',
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
    category: 'interface',
    labelKey: 'settings.interfaceMode.title',
    descriptionKey: 'settings.interfaceMode.description',
    anchor: 'settings-interface-mode',
    keywords: ['basic', 'advanced', 'expert', 'mode'],
  },
  {
    id: 'theme',
    category: 'appearance',
    labelKey: 'settings.appearance.theme',
    descriptionKey: 'settings.appearance.themeDescription',
    anchor: 'settings-theme',
    keywords: ['palette', 'dark', 'light', 'colors', 'nord', 'gruvbox', 'rose-pine', 'one-dark', 'solarized'],
  },
  {
    id: 'custom-theme',
    category: 'appearance',
    labelKey: 'settings.customTheme.title',
    descriptionKey: 'settings.customTheme.description',
    anchor: 'settings-theme',
    keywords: ['custom', 'palette', 'colors', 'accent', 'background', 'hex'],
  },
  {
    id: 'font-size',
    category: 'appearance',
    labelKey: 'settings.fontSize.title',
    descriptionKey: 'settings.fontSize.description',
    anchor: 'settings-font-size',
    keywords: ['font', 'text', 'zoom', 'size', 'accessibility', 'readability'],
  },
  {
    id: 'remote-avatars',
    category: 'privacy',
    labelKey: 'settings.avatars.authorAvatars',
    descriptionKey: 'settings.avatars.authorAvatarsDescription',
    anchor: 'settings-remote-avatars',
    keywords: ['gravatar', 'github', 'images'],
  },
  {
    id: 'avatar-cache',
    category: 'privacy',
    labelKey: 'settings.avatars.clearCache',
    descriptionKey: 'settings.avatars.clearCacheDescription',
    anchor: 'settings-avatar-cache',
    keywords: ['gravatar', 'github'],
  },
  {
    id: 'language',
    category: 'language',
    labelKey: 'settings.language.title',
    descriptionKey: 'settings.language.description',
    anchor: 'settings-language',
    keywords: ['locale', 'translation', 'english', 'portuguese', 'chinese'],
  },
  {
    id: 'left-sidebar',
    category: 'interface',
    labelKey: 'settings.layout.showLeftSidebar',
    descriptionKey: 'settings.layout.showLeftSidebarDescription',
    anchor: 'settings-left-sidebar',
    keywords: ['panel', 'branches'],
  },
  {
    id: 'right-panel',
    category: 'interface',
    labelKey: 'settings.layout.showRightPanel',
    descriptionKey: 'settings.layout.showRightPanelDescription',
    anchor: 'settings-right-panel',
    keywords: ['panel', 'diff', 'working tree'],
  },
  {
    id: 'reset-layout',
    category: 'interface',
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

export interface SettingsHighlightSegment {
  text: string
  /** True when the segment matched a query term and should be highlighted. */
  match: boolean
}

/**
 * Split `text` into highlighted and plain segments for the given query.
 * Matching uses the same normalization as `searchSettings`, so accents and
 * case are ignored while the returned segments keep the original text.
 */
export function highlightSettingsMatches(text: string, query: string): SettingsHighlightSegment[] {
  const terms = normalizeSettingsQuery(query).split(/\s+/).filter(Boolean)
  if (!text || terms.length === 0) return [{ text, match: false }]

  // Normalize per character so normalized offsets map back to the source text.
  const characters = [...text]
  const map: number[] = []
  let normalized = ''
  characters.forEach((character, index) => {
    for (const part of normalizeSettingsQuery(character)) {
      normalized += part
      map.push(index)
    }
  })

  const ranges: Array<[number, number]> = []
  for (const term of terms) {
    let from = normalized.indexOf(term)
    while (from !== -1) {
      const last = map[from + term.length - 1]
      if (last !== undefined) ranges.push([map[from] ?? 0, last + 1])
      from = normalized.indexOf(term, from + term.length)
    }
  }
  if (ranges.length === 0) return [{ text, match: false }]

  ranges.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const range of ranges) {
    const previous = merged[merged.length - 1]
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1])
    else merged.push([...range])
  }

  const segments: SettingsHighlightSegment[] = []
  let cursor = 0
  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: characters.slice(cursor, start).join(''), match: false })
    segments.push({ text: characters.slice(start, end).join(''), match: true })
    cursor = end
  }
  if (cursor < characters.length) {
    segments.push({ text: characters.slice(cursor).join(''), match: false })
  }
  return segments
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
