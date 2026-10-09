import { defineStore } from 'pinia'
import type { GraphScope } from '@shared/git/models'
import { syncThemePreference } from '@/lib/applyTheme'
import {
  clampCommitGraphLimit,
  clampColumnWidth,
  clampLeftSidebarSize,
  clampRightSidebarSize,
  clampTerminalPanelSize,
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
  type RepoTabPref,
  type SectionKey,
  type UiMode,
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
  terminalPanelSize: number
  leftCollapsed: boolean
  rightCollapsed: boolean
  sections: Record<string, boolean>
  columns: UserPreferences['columns']
  columnWidths: UserPreferences['columnWidths']
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
  diffWordWrap: boolean
  signOffCommit: boolean
  signCommit: boolean
}): UserPreferences {
  return {
    leftSize: state.leftSize,
    rightSize: state.rightSize,
    workingTreeChangesSize: state.workingTreeChangesSize,
    terminalPanelSize: state.terminalPanelSize,
    leftCollapsed: state.leftCollapsed,
    rightCollapsed: state.rightCollapsed,
    sections: state.sections,
    columns: state.columns,
    columnWidths: state.columnWidths,
    graphScopeAll: state.graphScopeAll,
    commitGraphLimit: state.commitGraphLimit,
    fileListView: state.fileListView,
    lastRepositoryPath: state.lastRepositoryPath,
    openRepoTabs: state.openRepoTabs,
    diffViewMode: state.diffViewMode,
    theme: state.theme,
    uiMode: state.uiMode,
    ignoreWhitespace: state.ignoreWhitespace,
    blameWordWrap: state.blameWordWrap,
    diffWordWrap: state.diffWordWrap,
    signOffCommit: state.signOffCommit,
    signCommit: state.signCommit,
  }
}

export const useUiStore = defineStore('ui', {
  state: () => ({
    leftSize: 18,
    rightSize: 24,
    workingTreeChangesSize: defaultPreferences().workingTreeChangesSize,
    terminalPanelSize: defaultPreferences().terminalPanelSize,
    leftCollapsed: false,
    rightCollapsed: false,
    sections: { ...DEFAULT_SECTIONS } as Record<string, boolean>,
    columns: { ...DEFAULT_COLUMNS },
    columnWidths: { ...DEFAULT_COLUMN_WIDTHS },
    graphScopeAll: true,
    commitGraphLimit: defaultPreferences().commitGraphLimit,
    fileListView: 'path' as FileListView,
    lastRepositoryPath: null as string | null,
    openRepoTabs: [] as RepoTabPref[],
    diffViewMode: 'unified' as DiffViewMode,
    theme: defaultPreferences().theme,
    uiMode: defaultPreferences().uiMode,
    ignoreWhitespace: false,
    blameWordWrap: false,
    diffWordWrap: false,
    signOffCommit: false,
    signCommit: false,
    terminalOpen: false,
    commandPaletteOpen: false,
    settingsOpen: false,
    leftCollapseHint: false,
    rightCollapseHint: false,
    leftCollapsedBeforeDiff: null as boolean | null,
    suppressPaneAnimation: false,
  }),
  getters: {
    graphScope(state): GraphScope {
      return state.graphScopeAll ? 'all' : 'head'
    },
    clampedCommitGraphLimit(state): number {
      return clampCommitGraphLimit(state.commitGraphLimit)
    },
    isAdvanced(state): boolean {
      return state.uiMode === 'advanced'
    },
  },
  actions: {
    async hydrate(): Promise<void> {
      const saved = mergePreferences(await readPersisted())
      this.leftSize = saved.leftSize
      this.rightSize = saved.rightSize
      this.workingTreeChangesSize = saved.workingTreeChangesSize
      this.terminalPanelSize = saved.terminalPanelSize
      this.leftCollapsed = saved.leftCollapsed
      this.rightCollapsed = saved.rightCollapsed
      this.sections = { ...saved.sections }
      this.columns = saved.columns
      this.columnWidths = saved.columnWidths
      this.graphScopeAll = saved.graphScopeAll
      this.commitGraphLimit = saved.commitGraphLimit
      this.fileListView = saved.fileListView
      this.lastRepositoryPath = saved.lastRepositoryPath
      this.openRepoTabs = saved.openRepoTabs.map((tab) => ({ ...tab }))
      this.diffViewMode = saved.diffViewMode
      this.theme = saved.theme
      this.uiMode = saved.uiMode
      this.ignoreWhitespace = saved.ignoreWhitespace
      this.blameWordWrap = saved.blameWordWrap
      this.diffWordWrap = saved.diffWordWrap
      this.signOffCommit = saved.signOffCommit
      this.signCommit = saved.signCommit
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
          terminalPanelSize: this.terminalPanelSize,
          leftCollapsed: this.leftCollapsed,
          rightCollapsed: this.rightCollapsed,
          sections: this.sections,
          columns: this.columns,
          columnWidths: this.columnWidths,
          graphScopeAll: this.graphScopeAll,
          commitGraphLimit: this.clampedCommitGraphLimit,
          fileListView: this.fileListView,
          lastRepositoryPath: this.lastRepositoryPath,
          openRepoTabs: this.openRepoTabs,
          diffViewMode: this.diffViewMode,
          theme: this.theme,
          uiMode: this.uiMode,
          ignoreWhitespace: this.ignoreWhitespace,
          blameWordWrap: this.blameWordWrap,
          diffWordWrap: this.diffWordWrap,
          signOffCommit: this.signOffCommit,
          signCommit: this.signCommit,
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
    setTerminalPanelSize(size: number): void {
      this.terminalPanelSize = clampTerminalPanelSize(size)
    },
    toggleTerminal(): void {
      this.terminalOpen = !this.terminalOpen
    },
    openCommandPalette(): void {
      this.commandPaletteOpen = true
    },
    closeCommandPalette(): void {
      this.commandPaletteOpen = false
    },
    toggleCommandPalette(): void {
      this.commandPaletteOpen = !this.commandPaletteOpen
    },
    openTerminal(): void {
      this.terminalOpen = true
    },
    closeTerminal(): void {
      this.terminalOpen = false
    },
    toggleLeft(): void {
      this.leftCollapsed = !this.leftCollapsed
    },
    toggleRight(): void {
      this.rightCollapsed = !this.rightCollapsed
    },
    autoCollapseLeftForDiff(): void {
      if (this.leftCollapsedBeforeDiff !== null) return
      this.leftCollapsedBeforeDiff = this.leftCollapsed
      if (!this.leftCollapsed) {
        this.leftCollapsed = true
        this.suppressPaneAnimation = true
      }
    },
    restoreLeftAfterDiff(): void {
      if (this.leftCollapsedBeforeDiff === null) return
      const wasExpanded = !this.leftCollapsedBeforeDiff
      this.leftCollapsedBeforeDiff = null
      if (wasExpanded) {
        this.leftCollapsed = false
        this.suppressPaneAnimation = true
      }
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
    setOpenRepoTabs(tabs: RepoTabPref[], activePath: string | null): void {
      this.openRepoTabs = tabs.map((tab) => ({ ...tab }))
      this.lastRepositoryPath = activePath
    },
    setDiffViewMode(mode: DiffViewMode): void {
      this.diffViewMode = mode
    },
    setIgnoreWhitespace(value: boolean): void {
      this.ignoreWhitespace = value
    },
    setBlameWordWrap(value: boolean): void {
      this.blameWordWrap = value
    },
    setDiffWordWrap(value: boolean): void {
      this.diffWordWrap = value
    },
    setSignOffCommit(value: boolean): void {
      this.signOffCommit = value
    },
    setSignCommit(value: boolean): void {
      this.signCommit = value
    },
    setFileListView(view: FileListView): void {
      this.fileListView = view
    },
    setTheme(theme: ThemePreference): void {
      this.theme = theme
      syncThemePreference(theme)
    },
    setUiMode(mode: UiMode): void {
      this.uiMode = mode
      if (mode === 'basic') this.closeTerminal()
    },
    resetLayout(): void {
      const d = defaultPreferences()
      this.leftSize = d.leftSize
      this.rightSize = d.rightSize
      this.workingTreeChangesSize = d.workingTreeChangesSize
      this.terminalPanelSize = d.terminalPanelSize
      this.leftCollapsed = d.leftCollapsed
      this.rightCollapsed = d.rightCollapsed
    },
  },
})
