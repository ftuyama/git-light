import { defineStore } from 'pinia'
import { normalizeCompareRange, type CompareRange } from '@/lib/graph/compareRange'
import { useRepositoryStore } from './repository'

export type { CompareRange }

export const PENDING_BRANCH_ROW = '__pending__' as const

export type BranchCreationDisplay = typeof PENDING_BRANCH_ROW | string

export interface BranchCreation {
  /** Where to render the inline branch name input. */
  display: BranchCreationDisplay
  /** Git ref/SHA to create the branch from. */
  startPoint?: string
}

export const useSelectionStore = defineStore('selection', {
  state: () => ({
    selectedSha: null as string | null,
    selectedBranchId: null as string | null,
    hoveredSha: null as string | null,
    compareRange: null as CompareRange | null,
    branchCreation: null as BranchCreation | null,
  }),

  getters: {
    isCompareMode(): boolean {
      return this.compareRange != null
    },
  },

  actions: {
    select(sha: string | null): void {
      this.selectedSha = sha
      this.selectedBranchId = null
      this.compareRange = null
      if (this.branchCreation) {
        if (this.branchCreation.display === PENDING_BRANCH_ROW) {
          if (sha !== null) this.branchCreation = null
        } else if (sha !== this.branchCreation.display) {
          this.branchCreation = null
        }
      }
    },

    beginBranchCreation(options: BranchCreation): void {
      this.branchCreation = options
      this.selectedSha =
        options.display === PENDING_BRANCH_ROW ? null : options.display
      this.selectedBranchId = null
      this.compareRange = null
    },

    cancelBranchCreation(): void {
      this.branchCreation = null
    },

    /** Sidebar branch click: highlight the branch and jump to its tip commit. */
    selectBranch(branchId: string, tipSha: string): void {
      this.selectedBranchId = branchId
      this.selectedSha = tipSha
      this.compareRange = null
    },

    hover(sha: string | null): void {
      this.hoveredSha = sha
    },

    /** Shift+click: compare selected commit with another. */
    selectWithShift(sha: string): void {
      const repo = useRepositoryStore()
      if (!this.selectedSha || this.selectedSha === sha) {
        this.select(sha)
        return
      }
      this.compareRange = normalizeCompareRange(this.selectedSha, sha, repo.commits)
      this.selectedSha = sha
      this.selectedBranchId = null
    },

    clearCompare(): void {
      this.compareRange = null
    },

    moveBy(delta: number): void {
      const repo = useRepositoryStore()
      const commits = repo.commits
      if (commits.length === 0) return
      const current = this.selectedSha
        ? commits.findIndex((c) => c.sha === this.selectedSha)
        : -1
      const next = Math.min(commits.length - 1, Math.max(0, current + delta))
      this.select(commits[next].sha)
    },

    selectIndex(index: number): void {
      const repo = useRepositoryStore()
      const commits = repo.commits
      if (index < 0 || index >= commits.length) return
      this.select(commits[index].sha)
    },
  },
})
