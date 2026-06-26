import { defineStore } from 'pinia'
import { normalizeCompareRange, type CompareRange } from '@/lib/graph/compareRange'
import { useRepositoryStore } from './repository'

export type { CompareRange }

export const useSelectionStore = defineStore('selection', {
  state: () => ({
    selectedSha: null as string | null,
    selectedBranchId: null as string | null,
    hoveredSha: null as string | null,
    compareRange: null as CompareRange | null,
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

    /** Shift+click: compare selected commit with another (GitKraken-style). */
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
