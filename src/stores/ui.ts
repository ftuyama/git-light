import { defineStore } from 'pinia'
import type { GraphScope } from '@shared/git/models'
import {
  clampCommitGraphLimit,
  clampColumnWidth,
  clampWorkingTreeChangesSize,
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
  type UserPreferences,
} from '@/lib/preferences'

const LEGACY_STORE_KEY = 'git-light:ui'

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
  }
}

export const useUiStore = defineStore('ui', {
  state: () => ({
    leftSize: 18,
    rightSize: 24,
    workingTreeChangesSize: defaultPreferences().workingTreeChangesSize,
    leftCollapsed: false,
    rightCollapsed: false,
    sections: { ...DEFAULT_SECTIONS },
    columns: { ...DEFAULT_COLUMNS },
    columnWidths: { ...DEFAULT_COLUMN_WIDTHS },
    graphScopeAll: true,
    commitGraphLimit: defaultPreferences().commitGraphLimit,
    fileListView: 'path' as FileListView,
    lastRepositoryPath: null as string | null,
    diffViewMode: 'unified' as DiffViewMode,
    commandPaletteOpen: false,
    settingsOpen: false,
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
      this.sections = saved.sections
      this.columns = saved.columns
      this.columnWidths = saved.columnWidths
      this.graphScopeAll = saved.graphScopeAll
      this.commitGraphLimit = saved.commitGraphLimit
      this.fileListView = saved.fileListView
      this.lastRepositoryPath = saved.lastRepositoryPath
      this.diffViewMode = saved.diffViewMode
      let timer: ReturnType<typeof setTimeout> | undefined
      this.$subscribe(() => {
        clearTimeout(timer)
        timer = setTimeout(() => {
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
            }),
          )
        }, 200)
      })
    },
    setLeftSize(size: number): void {
      this.leftSize = size
    },
    setRightSize(size: number): void {
      this.rightSize = size
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
      this.sections[key] = !this.sections[key]
    },
    isSectionOpen(key: string): boolean {
      return this.sections[key] ?? true
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
      this.sections[key] = open
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
