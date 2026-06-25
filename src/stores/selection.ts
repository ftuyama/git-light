import { defineStore } from 'pinia'
import { useRepositoryStore } from './repository'

export const useSelectionStore = defineStore('selection', {
  state: () => ({
    selectedSha: null as string | null,
    hoveredSha: null as string | null,
  }),
  actions: {
    select(sha: string | null): void {
      this.selectedSha = sha
    },
    hover(sha: string | null): void {
      this.hoveredSha = sha
    },
    moveBy(delta: number): void {
      const repo = useRepositoryStore()
      const commits = repo.commits
      if (commits.length === 0) return
      const current = this.selectedSha
        ? commits.findIndex((c) => c.sha === this.selectedSha)
        : -1
      const next = Math.min(commits.length - 1, Math.max(0, current + delta))
      this.selectedSha = commits[next].sha
    },
    selectIndex(index: number): void {
      const repo = useRepositoryStore()
      const commits = repo.commits
      if (index < 0 || index >= commits.length) return
      this.selectedSha = commits[index].sha
    },
  },
})
