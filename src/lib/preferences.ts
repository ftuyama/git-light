import { isThemePreference, type ThemePreference } from './themes'
import { sanitizeKeymap, type Keymap } from './keybindings'
import { isAppLocale, type AppLocale } from './locales'

export type CommitColumnKey = 'author' | 'sha' | 'when'

export type FileListView = 'path' | 'tree'

/** Catalog keys (`settings.columns.*`); translate at render time. */
export const COLUMN_LABEL_KEYS: Record<CommitColumnKey, string> = {
  author: 'settings.columns.author',
  sha: 'settings.columns.sha',
  when: 'settings.columns.when',
}

export const SECTION_KEYS = [
  'favorites',
  'localBranches',
  'remoteBranches',
  'tags',
  'stashes',
  'worktrees',
] as const

export type SectionKey = (typeof SECTION_KEYS)[number]

/** Catalog keys (`settings.sections.*`); translate at render time. */
export const SECTION_LABEL_KEYS: Record<SectionKey, string> = {
  favorites: 'settings.sections.favorites',
  localBranches: 'settings.sections.localBranches',
  remoteBranches: 'settings.sections.remoteBranches',
  tags: 'settings.sections.tags',
  stashes: 'settings.sections.stashes',
  worktrees: 'settings.sections.worktrees',
}

export const ADVANCED_SECTION_KEYS = ['tags', 'stashes', 'worktrees'] as const satisfies readonly SectionKey[]

export type SidebarSectionState = 'expanded' | 'collapsed' | 'hidden'

export const SIDEBAR_SECTION_STATES: readonly SidebarSectionState[] = ['expanded', 'collapsed', 'hidden']

/** Catalog keys (`settings.sectionStates.*`); translate at render time. */
export const SIDEBAR_SECTION_STATE_LABEL_KEYS: Record<SidebarSectionState, string> = {
  expanded: 'settings.sectionStates.expanded',
  collapsed: 'settings.sectionStates.collapsed',
  hidden: 'settings.sectionStates.hidden',
}

export const DEFAULT_VISIBLE_SECTIONS: Record<SectionKey, boolean> = {
  favorites: true,
  localBranches: true,
  remoteBranches: true,
  tags: true,
  stashes: true,
  worktrees: true,
}

export interface CommitColumnPrefs {
  author: boolean
  sha: boolean
  when: boolean
}

export const COMMIT_GRAPH_LIMIT_MIN = 25
export const COMMIT_GRAPH_LIMIT_RECOMMENDED = 500
export const DEFAULT_COMMIT_GRAPH_LIMIT = COMMIT_GRAPH_LIMIT_RECOMMENDED

export function clampCommitGraphLimit(value: number): number {
  const rounded = Math.round(value)
  if (!Number.isFinite(rounded)) return DEFAULT_COMMIT_GRAPH_LIMIT
  return Math.max(COMMIT_GRAPH_LIMIT_MIN, rounded)
}

export type DiffViewMode = 'unified' | 'split'

export type UiMode = 'basic' | 'advanced'
export function isUiMode(value: unknown): value is UiMode {
  return value === 'basic' || value === 'advanced'
}

/** Global text/interface scale offered by the Appearance > Font size setting. */
export const FONT_SCALE_OPTIONS = [0.9, 1, 1.1, 1.25, 1.5] as const

export const DEFAULT_FONT_SCALE = 1

export function clampFontScale(value: unknown): number {
  return typeof value === 'number' && (FONT_SCALE_OPTIONS as readonly number[]).includes(value)
    ? value
    : DEFAULT_FONT_SCALE
}

export const AUTO_FETCH_INTERVAL_OPTIONS = [0, 60, 300, 600, 1800, 3600, 7200] as const

export const DEFAULT_AUTO_FETCH_INTERVAL_SEC = 300

export function clampAutoFetchIntervalSec(value: unknown): number {
  const rounded =
    typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : DEFAULT_AUTO_FETCH_INTERVAL_SEC
  return (AUTO_FETCH_INTERVAL_OPTIONS as readonly number[]).includes(rounded)
    ? rounded
    : DEFAULT_AUTO_FETCH_INTERVAL_SEC
}

export const WORKING_TREE_CHANGES_SIZE_MIN = 20
export const WORKING_TREE_CHANGES_SIZE_MAX = 80
export const DEFAULT_WORKING_TREE_CHANGES_SIZE = 62

export function clampWorkingTreeChangesSize(value: number): number {
  return Math.min(
    WORKING_TREE_CHANGES_SIZE_MAX,
    Math.max(WORKING_TREE_CHANGES_SIZE_MIN, Math.round(value)),
  )
}

export const LEFT_SIDEBAR_SIZE_MIN = 14
export const LEFT_SIDEBAR_SIZE_MAX = 36
export const LEFT_SIDEBAR_COLLAPSE_SIZE = 12
export const LEFT_SIDEBAR_COLLAPSE_HINT_SIZE = LEFT_SIDEBAR_COLLAPSE_SIZE + 6

export const RIGHT_SIDEBAR_SIZE_MIN = 16
export const RIGHT_SIDEBAR_SIZE_MAX = 44
export const RIGHT_SIDEBAR_COLLAPSE_SIZE = 14
export const RIGHT_SIDEBAR_COLLAPSE_HINT_SIZE = RIGHT_SIDEBAR_COLLAPSE_SIZE + 6

export function clampLeftSidebarSize(value: number): number {
  return Math.min(
    LEFT_SIDEBAR_SIZE_MAX,
    Math.max(LEFT_SIDEBAR_SIZE_MIN, Math.round(value)),
  )
}

export function clampRightSidebarSize(value: number): number {
  return Math.min(
    RIGHT_SIDEBAR_SIZE_MAX,
    Math.max(RIGHT_SIDEBAR_SIZE_MIN, Math.round(value)),
  )
}

export function shouldCollapseLeftSidebar(size: number): boolean {
  return size <= LEFT_SIDEBAR_COLLAPSE_SIZE
}

export function shouldCollapseRightSidebar(size: number): boolean {
  return size <= RIGHT_SIDEBAR_COLLAPSE_SIZE
}

export function isInLeftSidebarCollapseHintZone(size: number): boolean {
  return size <= LEFT_SIDEBAR_COLLAPSE_HINT_SIZE
}

export function isInRightSidebarCollapseHintZone(size: number): boolean {
  return size <= RIGHT_SIDEBAR_COLLAPSE_HINT_SIZE
}

export function shouldShowLeftSidebarCollapseHint(
  liveSize: number,
  storedSize: number,
): boolean {
  return liveSize < storedSize && isInLeftSidebarCollapseHintZone(liveSize)
}

export function shouldShowRightSidebarCollapseHint(
  liveSize: number,
  storedSize: number,
): boolean {
  return liveSize < storedSize && isInRightSidebarCollapseHintZone(liveSize)
}

export interface RepoTabPref {
  path: string
  name: string
  alias?: string
}

export interface UserPreferences {
  leftSize: number
  rightSize: number
  workingTreeChangesSize: number
  leftCollapsed: boolean
  rightCollapsed: boolean
  sections: Record<string, boolean>
  visibleSections: Record<string, boolean>
  columns: CommitColumnPrefs
  columnWidths: CommitColumnWidths
  graphScopeAll: boolean
  commitGraphLimit: number
  showTimeMarkers: boolean
  showMergeIndicators: boolean
  fileListView: FileListView
  lastRepositoryPath: string | null
  openRepoTabs: RepoTabPref[]
  diffViewMode: DiffViewMode
  theme: ThemePreference
  /** Global text/interface scale; `1` = 100%. See `FONT_SCALE_OPTIONS`. */
  fontScale: number
  uiMode: UiMode
  /** `null` = follow the OS locale detected at startup. */
  locale: AppLocale | null
  ignoreWhitespace: boolean
  blameWordWrap: boolean
  diffWordWrap: boolean
  signOffCommit: boolean
  signCommit: boolean
  remoteAvatars: boolean
  autoFetchIntervalSec: number
  keybindings?: Keymap
}

export const PREFERENCES_KEY = 'git-light:preferences'

export const DEFAULT_SECTIONS: Record<SectionKey, boolean> = {
  favorites: true,
  localBranches: true,
  remoteBranches: false,
  tags: false,
  stashes: false,
  worktrees: false,
}

export const DEFAULT_COLUMNS: CommitColumnPrefs = {
  author: false,
  sha: false,
  when: true,
}

export type CommitColumnWidthKey = 'refs' | 'graph' | 'commit' | 'author' | 'sha' | 'when'

export interface CommitColumnWidths {
  refs: number
  graph: number
  commit: number
  author: number
  sha: number
  when: number
}

export const DEFAULT_COLUMN_WIDTHS: CommitColumnWidths = {
  refs: 140,
  graph: 300,
  commit: 240,
  author: 96,
  sha: 56,
  when: 96,
}

/** Catalog keys (`settings.columnWidths.*`); translate at render time. */
export const COLUMN_WIDTH_LABEL_KEYS: Record<CommitColumnWidthKey, string> = {
  refs: 'settings.columnWidths.refs',
  graph: 'settings.columnWidths.graph',
  commit: 'settings.columnWidths.commit',
  author: 'settings.columnWidths.author',
  sha: 'settings.columnWidths.sha',
  when: 'settings.columnWidths.when',
}

export const COLUMN_WIDTH_LIMITS: Record<CommitColumnWidthKey, { min: number; max: number }> = {
  refs: { min: 56, max: 360 },
  graph: { min: 56, max: Number.POSITIVE_INFINITY },
  commit: { min: 120, max: 720 },
  author: { min: 56, max: 360 },
  sha: { min: 56, max: 360 },
  when: { min: 56, max: 360 },
}

export function clampColumnWidth(key: CommitColumnWidthKey, value: number): number {
  const { min, max } = COLUMN_WIDTH_LIMITS[key]
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function defaultPreferences(): UserPreferences {
  return {
    leftSize: 18,
    rightSize: 24,
    workingTreeChangesSize: DEFAULT_WORKING_TREE_CHANGES_SIZE,
    leftCollapsed: false,
    rightCollapsed: false,
    sections: { ...DEFAULT_SECTIONS },
    visibleSections: { ...DEFAULT_VISIBLE_SECTIONS },
    columns: { ...DEFAULT_COLUMNS },
    columnWidths: { ...DEFAULT_COLUMN_WIDTHS },
    graphScopeAll: true,
    commitGraphLimit: DEFAULT_COMMIT_GRAPH_LIMIT,
    showTimeMarkers: true,
    showMergeIndicators: true,
    fileListView: 'path',
    lastRepositoryPath: null,
    openRepoTabs: [],
    diffViewMode: 'unified',
    theme: 'default',
    fontScale: DEFAULT_FONT_SCALE,
    uiMode: 'advanced',
    locale: null,
    ignoreWhitespace: false,
    blameWordWrap: false,
    diffWordWrap: false,
    signOffCommit: false,
    signCommit: false,
    remoteAvatars: true,
    autoFetchIntervalSec: DEFAULT_AUTO_FETCH_INTERVAL_SEC,
    keybindings: undefined,
  }
}

export function mergePreferences(saved: Partial<UserPreferences> | null): UserPreferences {
  const defaults = defaultPreferences()
  if (!saved) return defaults
  return {
    leftSize: clampLeftSidebarSize(saved.leftSize ?? defaults.leftSize),
    rightSize: clampRightSidebarSize(saved.rightSize ?? defaults.rightSize),
    workingTreeChangesSize: clampWorkingTreeChangesSize(
      saved.workingTreeChangesSize ?? defaults.workingTreeChangesSize,
    ),
    leftCollapsed: saved.leftCollapsed ?? defaults.leftCollapsed,
    rightCollapsed: saved.rightCollapsed ?? defaults.rightCollapsed,
    sections: { ...DEFAULT_SECTIONS, ...(saved.sections ?? {}) },
    visibleSections: { ...DEFAULT_VISIBLE_SECTIONS, ...(saved.visibleSections ?? {}) },
    columns: { ...DEFAULT_COLUMNS, ...(saved.columns ?? {}) },
    columnWidths: { ...DEFAULT_COLUMN_WIDTHS, ...(saved.columnWidths ?? {}) },
    graphScopeAll: saved.graphScopeAll ?? defaults.graphScopeAll,
    commitGraphLimit: clampCommitGraphLimit(saved.commitGraphLimit ?? defaults.commitGraphLimit),
    showTimeMarkers: saved.showTimeMarkers ?? defaults.showTimeMarkers,
    showMergeIndicators: saved.showMergeIndicators ?? defaults.showMergeIndicators,
    fileListView: saved.fileListView ?? defaults.fileListView,
    lastRepositoryPath: saved.lastRepositoryPath ?? defaults.lastRepositoryPath,
    openRepoTabs: Array.isArray(saved.openRepoTabs)
      ? saved.openRepoTabs
          .filter(
            (tab): tab is RepoTabPref =>
              typeof tab === 'object' &&
              tab != null &&
              typeof tab.path === 'string' &&
              typeof tab.name === 'string',
          )
          .map((tab) => ({
            path: tab.path,
            name: tab.name,
            ...(typeof tab.alias === 'string' && tab.alias.trim() ? { alias: tab.alias } : {}),
          }))
      : defaults.openRepoTabs,
    diffViewMode: saved.diffViewMode === 'split' ? 'split' : 'unified',
    theme: isThemePreference(saved.theme) ? saved.theme : defaults.theme,
    fontScale: clampFontScale(saved.fontScale ?? defaults.fontScale),
    uiMode: isUiMode(saved.uiMode) ? saved.uiMode : defaults.uiMode,
    locale: isAppLocale(saved.locale) ? saved.locale : defaults.locale,
    ignoreWhitespace: saved.ignoreWhitespace ?? defaults.ignoreWhitespace,
    blameWordWrap: saved.blameWordWrap ?? defaults.blameWordWrap,
    diffWordWrap: saved.diffWordWrap ?? defaults.diffWordWrap,
    signOffCommit: saved.signOffCommit ?? defaults.signOffCommit,
    signCommit: saved.signCommit ?? defaults.signCommit,
    remoteAvatars: saved.remoteAvatars ?? defaults.remoteAvatars,
    autoFetchIntervalSec: clampAutoFetchIntervalSec(
      saved.autoFetchIntervalSec ?? defaults.autoFetchIntervalSec,
    ),
    keybindings: saved.keybindings !== undefined ? sanitizeKeymap(saved.keybindings) : undefined,
  }
}
