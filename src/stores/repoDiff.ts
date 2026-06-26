import { defineStore } from 'pinia'
import type { ConflictResult, DiffResult } from '@shared/git/models'
import type { WorkingTreeFile } from '@/types/git'
import { gitService } from '@/lib/git'
import { useRepositoryStore } from './repository'
import { useSelectionStore } from './selection'
import { useToastStore } from './toast'

export const useRepoDiffStore = defineStore('repoDiff', {
  state: () => ({
    selectedFilePath: null as string | null,
    selectedFileStaged: null as boolean | null,
    commitFiles: [] as WorkingTreeFile[],
    commitFilesLoading: false,
    compareFiles: [] as WorkingTreeFile[],
    compareFilesLoading: false,
    diff: null as DiffResult | null,
    diffLoading: false,
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
    selectFile(path: string | null, options?: { staged?: boolean }): void {
      this.selectedFilePath = path
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
      this.conflict = null
      if (!path) return
      if (repo.workingTree.find((f) => f.path === path)?.status === 'conflicted') {
        void this.loadConflict(path)
      } else {
        void this.loadDiff(path)
      }
    },

    async loadCommitFiles(sha: string): Promise<void> {
      this.commitFilesLoading = true
      this.selectedFilePath = null
      this.selectedFileStaged = null
      this.diff = null
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
    },

    async loadDiff(path: string): Promise<void> {
      const selection = useSelectionStore()
      const repo = useRepositoryStore()
      const compare = selection.compareRange
      const viewingCompareFile = Boolean(compare) && this.compareFiles.some((f) => f.path === path)
      const commitSha = selection.selectedSha
      const viewingCommitFile =
        Boolean(commitSha) && !compare && this.commitFiles.some((f) => f.path === path)
      const staged =
        this.selectedFileStaged ??
        repo.workingTree.find((f) => f.path === path && f.staged)?.staged ??
        false
      this.diffLoading = true
      this.conflict = null
      try {
        if (viewingCompareFile && compare) {
          this.diff = await gitService.getDiff({
            path,
            source: 'range',
            sha: compare.fromSha,
            toSha: compare.toSha,
          })
        } else {
          this.diff = await gitService.getDiff(
            viewingCommitFile
              ? { path, source: 'commit', sha: commitSha! }
              : {
                  path,
                  source: staged ? 'index' : 'worktree',
                },
          )
        }
      } catch {
        this.diff = null
      } finally {
        this.diffLoading = false
      }
    },

    async loadConflict(path: string): Promise<void> {
      this.conflictLoading = true
      this.diff = null
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
      this.commitFiles = []
      this.compareFiles = []
      this.commitFilesLoading = false
      this.compareFilesLoading = false
      this.diff = null
      this.diffLoading = false
      this.conflict = null
      this.conflictLoading = false
    },
  },
})
