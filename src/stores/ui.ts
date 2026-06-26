import { defineStore } from 'pinia'
import type { GraphScope } from '@shared/git/models'
import { syncThemePreference } from '@/lib/applyTheme'
import {
  clampCommitGraphLimit,
  clampColumnWidth,
  clampLeftSidebarSize,
  clampRightSidebarSize,
  clampWorkingTreeChangesSize,
  shouldCollapseLeftSidebar,
  shouldCollapseRightSidebar,
  DEFAULT_COLUMNS,
  DEFAULT_COLUMN_WIDTHS,
  DEFAULT_SECTIONS,
  defaultPreferences,
  mergePreferences,
  PREFERENCES_KEY,
  type CommitColumnKey,
  type CommitColumnWidthKey,
  type DiffViewMode,
  type FileListView,
  type SectionKey,
  type UserPreferences,
} from '@/lib/preferences'
import type { ThemePreference } from '@/lib/themes'

const LEGACY_STORE_KEY = 'git-light:ui'
let persistTimer: ReturnType<typeof setTimeout> | undefined
let persistenceBound = false

async function readPersisted(): Promise<Partial<UserPreferences> | null> {
  if (window.electron?.store) {
    const current = await window.electron.store.get<Partial<UserPreferences> | null>(
      PREFERENCES_KEY,
      null,
    )
    if (current) return current
    return window.electron.store.get<Partial<UserPreferences> | null>(LEGACY_STORE_KEY, null)
  }
  try {
    const raw =
      localStorage.getItem(PREFERENCES_KEY) ?? localStorage.getItem(LEGACY_STORE_KEY)
    return raw ? (JSON.parse(raw) as Partial<UserPreferences>) : null
  } catch {
    return null
  }
}

function writePersisted(state: UserPreferences): void {
  if (window.electron?.store) {
    void window.electron.store.set(PREFERENCES_KEY, state)
    return
  }
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function snapshot(state: {
  leftSize: number
  rightSize: number
  workingTreeChangesSize: number
  leftCollapsed: boolean
  rightCollapsed: boolean
  sections: Record<string, boolean>
  columns: UserPreferences['columns']
  columnWidths: UserPreferences['columnWidths']
  graphScopeAll: boolean
  commitGraphLimit: number
  fileListView: FileListView
  lastRepositoryPath: string | null
  diffViewMode: DiffViewMode
  theme: ThemePreference
}): UserPreferences {
  return {
    leftSize: state.leftSize,
    rightSize: state.rightSize,
    workingTreeChangesSize: state.workingTreeChangesSize,
    leftCollapsed: state.leftCollapsed,
    rightCollapsed: state.rightCollapsed,
    sections: state.sections,
    columns: state.columns,
    columnWidths: state.columnWidths,
    graphScopeAll: state.graphScopeAll,
    commitGraphLimit: state.commitGraphLimit,
    fileListView: state.fileListView,
    lastRepositoryPath: state.lastRepositoryPath,
    diffViewMode: state.diffViewMode,
    theme: state.theme,
  }
}

export const useUiStore = defineStore('ui', {
  state: () => ({
    leftSize: 18,
    rightSize: 24,
    workingTreeChangesSize: defaultPreferences().workingTreeChangesSize,
    leftCollapsed: false,
    rightCollapsed: false,
    sections: { ...DEFAULT_SECTIONS } as Record<string, boolean>,
    columns: { ...DEFAULT_COLUMNS },
    columnWidths: { ...DEFAULT_COLUMN_WIDTHS },
    graphScopeAll: true,
    commitGraphLimit: defaultPreferences().commitGraphLimit,
    fileListView: 'path' as FileListView,
    lastRepositoryPath: null as string | null,
    diffViewMode: 'unified' as DiffViewMode,
    theme: defaultPreferences().theme,
    commandPaletteOpen: false,
    settingsOpen: false,
    leftCollapseHint: false,
    rightCollapseHint: false,
  }),
  getters: {
    graphScope(state): GraphScope {
      return state.graphScopeAll ? 'all' : 'head'
    },
    clampedCommitGraphLimit(state): number {
      return clampCommitGraphLimit(state.commitGraphLimit)
    },
  },
  actions: {
    async hydrate(): Promise<void> {
      const saved = mergePreferences(await readPersisted())
      this.leftSize = saved.leftSize
      this.rightSize = saved.rightSize
      this.workingTreeChangesSize = saved.workingTreeChangesSize
      this.leftCollapsed = saved.leftCollapsed
      this.rightCollapsed = saved.rightCollapsed
      this.sections = { ...saved.sections }
      this.columns = saved.columns
      this.columnWidths = saved.columnWidths
      this.graphScopeAll = saved.graphScopeAll
      this.commitGraphLimit = saved.commitGraphLimit
      this.fileListView = saved.fileListView
      this.lastRepositoryPath = saved.lastRepositoryPath
      this.diffViewMode = saved.diffViewMode
      this.theme = saved.theme
      syncThemePreference(this.theme)
      if (persistenceBound) return
      persistenceBound = true
      this.$subscribe(() => {
        clearTimeout(persistTimer)
        persistTimer = setTimeout(() => this.persistNow(), 200)
      })
      window.addEventListener('beforeunload', () => this.persistNow())
      window.electron?.onWindowBlur?.(() => this.persistNow())
    },
    persistNow(): void {
      clearTimeout(persistTimer)
      persistTimer = undefined
      writePersisted(
        snapshot({
          leftSize: this.leftSize,
          rightSize: this.rightSize,
          workingTreeChangesSize: this.workingTreeChangesSize,
          leftCollapsed: this.leftCollapsed,
          rightCollapsed: this.rightCollapsed,
          sections: this.sections,
          columns: this.columns,
          columnWidths: this.columnWidths,
          graphScopeAll: this.graphScopeAll,
          commitGraphLimit: this.clampedCommitGraphLimit,
          fileListView: this.fileListView,
          lastRepositoryPath: this.lastRepositoryPath,
          diffViewMode: this.diffViewMode,
          theme: this.theme,
        }),
      )
    },
    setLeftSize(size: number): void {
      if (shouldCollapseLeftSidebar(size)) {
        this.leftCollapsed = true
        return
      }
      this.leftSize = clampLeftSidebarSize(size)
    },
    setRightSize(size: number): void {
      if (shouldCollapseRightSidebar(size)) {
        this.rightCollapsed = true
        return
      }
      this.rightSize = clampRightSidebarSize(size)
    },
    setLeftCollapseHint(active: boolean): void {
      this.leftCollapseHint = active
    },
    setRightCollapseHint(active: boolean): void {
      this.rightCollapseHint = active
    },
    clearSidebarCollapseHints(): void {
      this.leftCollapseHint = false
      this.rightCollapseHint = false
    },
    setWorkingTreeChangesSize(size: number): void {
      this.workingTreeChangesSize = clampWorkingTreeChangesSize(size)
    },
    toggleLeft(): void {
      this.leftCollapsed = !this.leftCollapsed
    },
    toggleRight(): void {
      this.rightCollapsed = !this.rightCollapsed
    },
    toggleSection(key: string): void {
      this.sections = { ...this.sections, [key]: !this.isSectionOpen(key) }
    },
    isSectionOpen(key: string): boolean {
      if (key in this.sections) return this.sections[key]!
      if (key in DEFAULT_SECTIONS) return DEFAULT_SECTIONS[key as SectionKey]
      return true
    },
    isColumnVisible(key: CommitColumnKey): boolean {
      return this.columns[key] ?? DEFAULT_COLUMNS[key]
    },
    toggleColumn(key: CommitColumnKey): void {
      this.columns[key] = !this.isColumnVisible(key)
    },
    setColumnVisible(key: CommitColumnKey, visible: boolean): void {
      this.columns[key] = visible
    },
    setColumnWidth(key: CommitColumnWidthKey, width: number): void {
      this.columnWidths[key] = clampColumnWidth(key, width)
    },
    setSectionOpen(key: string, open: boolean): void {
      this.sections = { ...this.sections, [key]: open }
    },
    setLeftVisible(visible: boolean): void {
      this.leftCollapsed = !visible
    },
    setRightVisible(visible: boolean): void {
      this.rightCollapsed = !visible
    },
    setGraphScopeAll(value: boolean): void {
      this.graphScopeAll = value
    },
    setCommitGraphLimit(value: number): void {
      this.commitGraphLimit = clampCommitGraphLimit(value)
    },
    openSettings(): void {
      this.settingsOpen = true
    },
    closeSettings(): void {
      this.settingsOpen = false
    },
    setLastRepositoryPath(path: string | null): void {
      this.lastRepositoryPath = path
    },
    setDiffViewMode(mode: DiffViewMode): void {
      this.diffViewMode = mode
    },
    setFileListView(view: FileListView): void {
      this.fileListView = view
    },
    setTheme(theme: ThemePreference): void {
      this.theme = theme
      syncThemePreference(theme)
    },
    resetLayout(): void {
      const d = defaultPreferences()
      this.leftSize = d.leftSize
      this.rightSize = d.rightSize
      this.workingTreeChangesSize = d.workingTreeChangesSize
      this.leftCollapsed = d.leftCollapsed
      this.rightCollapsed = d.rightCollapsed
    },
  },
})
