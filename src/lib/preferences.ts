export type CommitColumnKey = 'author' | 'sha' | 'when'

export interface CommitColumnPrefs {
  author: boolean
  sha: boolean
  when: boolean
}

export interface UserPreferences {
  leftSize: number
  rightSize: number
  leftCollapsed: boolean
  rightCollapsed: boolean
  sections: Record<string, boolean>
  columns: CommitColumnPrefs
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

export function defaultPreferences(): UserPreferences {
  return {
    leftSize: 18,
    rightSize: 24,
    leftCollapsed: false,
    rightCollapsed: false,
    sections: { ...DEFAULT_SECTIONS },
    columns: { ...DEFAULT_COLUMNS },
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
    lastRepositoryPath: saved.lastRepositoryPath ?? defaults.lastRepositoryPath,
  }
}
