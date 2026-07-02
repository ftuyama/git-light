import { isThemePreference, type ThemePreference } from './themes'

export type CommitColumnKey = 'author' | 'sha' | 'when'

export type FileListView = 'path' | 'tree'

export const COLUMN_LABELS: Record<CommitColumnKey, string> = {
  author: 'Author',
  sha: 'SHA',
  when: 'When',
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

export const SECTION_LABELS: Record<SectionKey, string> = {
  favorites: 'Favorites',
  localBranches: 'Local Branches',
  remoteBranches: 'Remote Branches',
  tags: 'Tags',
  stashes: 'Stashes',
  worktrees: 'Worktrees',
}

export const ADVANCED_SECTION_KEYS = ['tags', 'stashes', 'worktrees'] as const satisfies readonly SectionKey[]

export interface CommitColumnPrefs {
  author: boolean
  sha: boolean
  when: boolean
}

export const COMMIT_GRAPH_LIMIT_MIN = 25
export const COMMIT_GRAPH_LIMIT_MAX = 500
export const DEFAULT_COMMIT_GRAPH_LIMIT = 100

export function clampCommitGraphLimit(value: number): number {
  return Math.min(COMMIT_GRAPH_LIMIT_MAX, Math.max(COMMIT_GRAPH_LIMIT_MIN, Math.round(value)))
}

export type DiffViewMode = 'unified' | 'split'

export type UiMode = 'basic' | 'advanced'

export function isUiMode(value: unknown): value is UiMode {
  return value === 'basic' || value === 'advanced'
}

export const WORKING_TREE_CHANGES_SIZE_MIN = 20
export const WORKING_TREE_CHANGES_SIZE_MAX = 80
export const DEFAULT_WORKING_TREE_CHANGES_SIZE = 62

export const TERMINAL_PANEL_SIZE_MIN = 15
export const TERMINAL_PANEL_SIZE_MAX = 70
export const DEFAULT_TERMINAL_PANEL_SIZE = 35

export function clampWorkingTreeChangesSize(value: number): number {
  return Math.min(
    WORKING_TREE_CHANGES_SIZE_MAX,
    Math.max(WORKING_TREE_CHANGES_SIZE_MIN, Math.round(value)),
  )
}

export function clampTerminalPanelSize(value: number): number {
  return Math.min(
    TERMINAL_PANEL_SIZE_MAX,
    Math.max(TERMINAL_PANEL_SIZE_MIN, Math.round(value)),
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
}

export interface UserPreferences {
  leftSize: number
  rightSize: number
  workingTreeChangesSize: number
  terminalPanelSize: number
  leftCollapsed: boolean
  rightCollapsed: boolean
  sections: Record<string, boolean>
  columns: CommitColumnPrefs
  columnWidths: CommitColumnWidths
  graphScopeAll: boolean
  commitGraphLimit: number
  fileListView: FileListView
  lastRepositoryPath: string | null
  openRepoTabs: RepoTabPref[]
  diffViewMode: DiffViewMode
  theme: ThemePreference
  uiMode: UiMode
  ignoreWhitespace: boolean
  blameWordWrap: boolean
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

export const COLUMN_WIDTH_LIMITS: Record<CommitColumnWidthKey, { min: number; max: number }> = {
  refs: { min: 56, max: 360 },
  graph: { min: 56, max: 360 },
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
    terminalPanelSize: DEFAULT_TERMINAL_PANEL_SIZE,
    leftCollapsed: false,
    rightCollapsed: false,
    sections: { ...DEFAULT_SECTIONS },
    columns: { ...DEFAULT_COLUMNS },
    columnWidths: { ...DEFAULT_COLUMN_WIDTHS },
    graphScopeAll: true,
    commitGraphLimit: DEFAULT_COMMIT_GRAPH_LIMIT,
    fileListView: 'path',
    lastRepositoryPath: null,
    openRepoTabs: [],
    diffViewMode: 'unified',
    theme: 'default',
    uiMode: 'advanced',
    ignoreWhitespace: false,
    blameWordWrap: false,
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
    terminalPanelSize: clampTerminalPanelSize(
      saved.terminalPanelSize ?? defaults.terminalPanelSize,
    ),
    leftCollapsed: saved.leftCollapsed ?? defaults.leftCollapsed,
    rightCollapsed: saved.rightCollapsed ?? defaults.rightCollapsed,
    sections: { ...DEFAULT_SECTIONS, ...(saved.sections ?? {}) },
    columns: { ...DEFAULT_COLUMNS, ...(saved.columns ?? {}) },
    columnWidths: { ...DEFAULT_COLUMN_WIDTHS, ...(saved.columnWidths ?? {}) },
    graphScopeAll: saved.graphScopeAll ?? defaults.graphScopeAll,
    commitGraphLimit: clampCommitGraphLimit(saved.commitGraphLimit ?? defaults.commitGraphLimit),
    fileListView: saved.fileListView ?? defaults.fileListView,
    lastRepositoryPath: saved.lastRepositoryPath ?? defaults.lastRepositoryPath,
    openRepoTabs: Array.isArray(saved.openRepoTabs)
      ? saved.openRepoTabs.filter(
          (tab): tab is RepoTabPref =>
            typeof tab === 'object' &&
            tab != null &&
            typeof tab.path === 'string' &&
            typeof tab.name === 'string',
        )
      : defaults.openRepoTabs,
    diffViewMode: saved.diffViewMode === 'split' ? 'split' : 'unified',
    theme: isThemePreference(saved.theme) ? saved.theme : defaults.theme,
    uiMode: isUiMode(saved.uiMode) ? saved.uiMode : defaults.uiMode,
    ignoreWhitespace: saved.ignoreWhitespace ?? defaults.ignoreWhitespace,
    blameWordWrap: saved.blameWordWrap ?? defaults.blameWordWrap,
  }
}
