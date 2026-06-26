export type CommitColumnKey = 'author' | 'sha' | 'when'

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

export interface UserPreferences {
  leftSize: number
  rightSize: number
  leftCollapsed: boolean
  rightCollapsed: boolean
  sections: Record<string, boolean>
  columns: CommitColumnPrefs
  columnWidths: CommitColumnWidths
  graphScopeAll: boolean
  commitGraphLimit: number
  lastRepositoryPath: string | null
}

export const PREFERENCES_KEY = 'git-light:preferences'

export const DEFAULT_SECTIONS: Record<string, boolean> = {
  localBranches: true,
  remoteBranches: false,
  tags: false,
  stashes: true,
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
  graph: 120,
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
    leftCollapsed: false,
    rightCollapsed: false,
    sections: { ...DEFAULT_SECTIONS },
    columns: { ...DEFAULT_COLUMNS },
    columnWidths: { ...DEFAULT_COLUMN_WIDTHS },
    graphScopeAll: true,
    commitGraphLimit: DEFAULT_COMMIT_GRAPH_LIMIT,
    lastRepositoryPath: null,
  }
}

export function mergePreferences(saved: Partial<UserPreferences> | null): UserPreferences {
  const defaults = defaultPreferences()
  if (!saved) return defaults
  return {
    leftSize: saved.leftSize ?? defaults.leftSize,
    rightSize: saved.rightSize ?? defaults.rightSize,
    leftCollapsed: saved.leftCollapsed ?? defaults.leftCollapsed,
    rightCollapsed: saved.rightCollapsed ?? defaults.rightCollapsed,
    sections: { ...DEFAULT_SECTIONS, ...(saved.sections ?? {}) },
    columns: { ...DEFAULT_COLUMNS, ...(saved.columns ?? {}) },
    columnWidths: { ...DEFAULT_COLUMN_WIDTHS, ...(saved.columnWidths ?? {}) },
    graphScopeAll: saved.graphScopeAll ?? defaults.graphScopeAll,
    commitGraphLimit: clampCommitGraphLimit(saved.commitGraphLimit ?? defaults.commitGraphLimit),
    lastRepositoryPath: saved.lastRepositoryPath ?? defaults.lastRepositoryPath,
  }
}
