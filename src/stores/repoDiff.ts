import { defineStore } from 'pinia'
import type { BlameResult, ConflictResult, DiffResult, FileHistoryEntry } from '@shared/git/models'
import type { WorkingTreeFile } from '@/types/git'
import { gitService } from '@/lib/git'
import { useRepositoryStore } from './repository'
import { useSelectionStore } from './selection'
import { useToastStore } from './toast'
import { useUiStore } from './ui'

export type FilePanelMode = 'diff' | 'blame'

export const useRepoDiffStore = defineStore('repoDiff', {
  state: () => ({
    selectedFilePath: null as string | null,
    selectedFileStaged: null as boolean | null,
    panelMode: 'diff' as FilePanelMode,
    commitFiles: [] as WorkingTreeFile[],
    commitFilesLoading: false,
    compareFiles: [] as WorkingTreeFile[],
    compareFilesLoading: false,
    diff: null as DiffResult | null,
    diffLoading: false,
    blame: null as BlameResult | null,
    blameLoading: false,
    blameRevisionSha: null as string | null,
    fileHistoryOpen: false,
    fileHistoryPath: null as string | null,
    fileHistoryEntries: [] as FileHistoryEntry[],
    fileHistoryLoading: false,
    conflict: null as ConflictResult | null,
    conflictLoading: false,
  }),

  getters: {
    selectedFileIsConflicted(): boolean {
      if (!this.selectedFilePath) return false
      const repo = useRepositoryStore()
      const file = repo.workingTree.find((f) => f.path === this.selectedFilePath)
      return file?.status === 'conflicted'
    },
  },

  actions: {
    setPanelMode(mode: FilePanelMode): void {
      this.panelMode = mode
      if (mode === 'diff') {
        this.blameRevisionSha = null
      }
      if (!this.selectedFilePath) return
      if (mode === 'blame') {
        void this.loadBlame(this.selectedFilePath)
      } else if (!this.selectedFileIsConflicted) {
        void this.loadDiff(this.selectedFilePath)
      }
    },

    selectFile(path: string | null, options?: { staged?: boolean }): void {
      this.selectedFilePath = path
      this.blameRevisionSha = null
      const repo = useRepositoryStore()
      if (path == null) {
        this.selectedFileStaged = null
      } else if (options?.staged !== undefined) {
        this.selectedFileStaged = options.staged
      } else {
        const file = repo.workingTree.find((f) => f.path === path)
        this.selectedFileStaged = file?.staged ?? false
      }
      this.diff = null
      this.blame = null
      this.conflict = null
      if (!path) return
      if (repo.workingTree.find((f) => f.path === path)?.status === 'conflicted') {
        this.panelMode = 'diff'
        void this.loadConflict(path)
      } else if (this.panelMode === 'blame') {
        void this.loadBlame(path)
      } else {
        void this.loadDiff(path)
      }
    },

    async loadCommitFiles(sha: string): Promise<void> {
      this.commitFilesLoading = true
      this.selectedFilePath = null
      this.selectedFileStaged = null
      this.diff = null
      this.blame = null
      this.compareFiles = []
      try {
        this.commitFiles = await gitService.getCommitFiles(sha)
      } catch (error) {
        this.commitFiles = []
        const detail = error instanceof Error ? error.message : String(error)
        useToastStore().push(`Could not load commit files: ${detail}`, 'error')
      } finally {
        this.commitFilesLoading = false
      }
    },

    async loadCompareFiles(fromSha: string, toSha: string): Promise<void> {
      this.compareFilesLoading = true
      this.commitFiles = []
      this.selectedFilePath = null
      this.selectedFileStaged = null
      this.diff = null
      this.blame = null
      try {
        this.compareFiles = await gitService.getCompareFiles(fromSha, toSha)
      } catch (error) {
        this.compareFiles = []
        const detail = error instanceof Error ? error.message : String(error)
        useToastStore().push(`Could not compare commits: ${detail}`, 'error')
      } finally {
        this.compareFilesLoading = false
      }
    },

    clearCommitFiles(): void {
      this.commitFiles = []
      this.compareFiles = []
      this.commitFilesLoading = false
      this.compareFilesLoading = false
      this.selectedFilePath = null
      this.selectedFileStaged = null
      this.diff = null
      this.blame = null
    },

    blameRequestForPath(path: string) {
      if (this.blameRevisionSha) {
        return { path, source: 'commit' as const, sha: this.blameRevisionSha }
      }

      const selection = useSelectionStore()
      const compare = selection.compareRange
      const viewingCompareFile = Boolean(compare) && this.compareFiles.some((f) => f.path === path)
      const commitSha = selection.selectedSha
      const viewingCommitFile =
        Boolean(commitSha) && !compare && this.commitFiles.some((f) => f.path === path)
      const staged =
        this.selectedFileStaged ??
        useRepositoryStore().workingTree.find((f) => f.path === path && f.staged)?.staged ??
        false

      if (viewingCompareFile && compare) {
        return {
          path,
          source: 'range' as const,
          sha: compare.fromSha,
          toSha: compare.toSha,
        }
      }
      if (viewingCommitFile) {
        return { path, source: 'commit' as const, sha: commitSha! }
      }
      return {
        path,
        source: staged ? ('index' as const) : ('worktree' as const),
      }
    },

    diffRequestForPath(path: string) {
      const selection = useSelectionStore()
      const compare = selection.compareRange
      const viewingCompareFile = Boolean(compare) && this.compareFiles.some((f) => f.path === path)
      const commitSha = selection.selectedSha
      const viewingCommitFile =
        Boolean(commitSha) && !compare && this.commitFiles.some((f) => f.path === path)
      const staged =
        this.selectedFileStaged ??
        useRepositoryStore().workingTree.find((f) => f.path === path && f.staged)?.staged ??
        false
      const ignoreWhitespace = useUiStore().ignoreWhitespace

      if (viewingCompareFile && compare) {
        return {
          path,
          source: 'range' as const,
          sha: compare.fromSha,
          toSha: compare.toSha,
          ignoreWhitespace,
        }
      }
      if (viewingCommitFile) {
        return { path, source: 'commit' as const, sha: commitSha!, ignoreWhitespace }
      }
      return {
        path,
        source: staged ? ('index' as const) : ('worktree' as const),
        ignoreWhitespace,
      }
    },

    async loadDiff(path: string): Promise<void> {
      this.diffLoading = true
      this.conflict = null
      this.blame = null
      try {
        this.diff = await gitService.getDiff(this.diffRequestForPath(path))
      } catch {
        this.diff = null
      } finally {
        this.diffLoading = false
      }
    },

    async loadBlame(path: string): Promise<void> {
      this.blameLoading = true
      this.conflict = null
      this.diff = null
      void this.loadFileHistory(path)
      try {
        this.blame = await gitService.getBlame(this.blameRequestForPath(path))
      } catch {
        this.blame = null
      } finally {
        this.blameLoading = false
      }
    },

    async loadFileHistory(path: string): Promise<void> {
      this.fileHistoryPath = path
      this.fileHistoryLoading = true
      this.fileHistoryEntries = []
      try {
        const result = await gitService.getFileHistory({ path, limit: 50 })
        this.fileHistoryEntries = result.entries
      } catch (error) {
        this.fileHistoryEntries = []
        if (this.fileHistoryOpen) {
          const detail = error instanceof Error ? error.message : String(error)
          useToastStore().push(`Could not load file history: ${detail}`, 'error')
        }
      } finally {
        this.fileHistoryLoading = false
      }
    },

    async openFileHistory(path: string): Promise<void> {
      this.fileHistoryOpen = true
      await this.loadFileHistory(path)
    },

    closeFileHistory(): void {
      this.fileHistoryOpen = false
    },

    async selectFileHistoryEntry(sha: string): Promise<void> {
      const path = this.fileHistoryPath
      if (!path) return
      const selection = useSelectionStore()
      selection.select(sha)
      await this.loadCommitFiles(sha)
      this.selectFile(path, { staged: false })
      this.closeFileHistory()
    },

    async selectBlameHistoryEntry(sha: string): Promise<void> {
      if (!this.selectedFilePath) return
      this.blameRevisionSha = sha
      useSelectionStore().select(sha)
      await this.loadBlame(this.selectedFilePath)
    },

    async reloadCurrentFile(): Promise<void> {
      if (!this.selectedFilePath) return
      if (this.selectedFileIsConflicted) {
        await this.loadConflict(this.selectedFilePath)
      } else if (this.panelMode === 'blame') {
        await this.loadBlame(this.selectedFilePath)
      } else {
        await this.loadDiff(this.selectedFilePath)
      }
    },

    async loadConflict(path: string): Promise<void> {
      this.conflictLoading = true
      this.diff = null
      this.blame = null
      try {
        this.conflict = await gitService.getConflict({ path })
      } catch {
        this.conflict = null
      } finally {
        this.conflictLoading = false
      }
    },

    async afterConflictAction(path: string): Promise<void> {
      const repo = useRepositoryStore()
      const stillConflicted = repo.workingTree.some(
        (f) => f.path === path && f.status === 'conflicted',
      )
      if (stillConflicted) {
        await this.loadConflict(path)
      } else if (this.selectedFilePath === path) {
        this.conflict = null
        await this.loadDiff(path)
      }
    },

    resetOnRepoClose(): void {
      this.selectedFilePath = null
      this.selectedFileStaged = null
      this.panelMode = 'diff'
      this.commitFiles = []
      this.compareFiles = []
      this.commitFilesLoading = false
      this.compareFilesLoading = false
      this.diff = null
      this.diffLoading = false
      this.blame = null
      this.blameLoading = false
      this.blameRevisionSha = null
      this.fileHistoryOpen = false
      this.fileHistoryPath = null
      this.fileHistoryEntries = []
      this.fileHistoryLoading = false
      this.conflict = null
      this.conflictLoading = false
    },
  },
})
