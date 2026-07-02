import { defineStore } from 'pinia'
import type { RecentRepository } from '@shared/git/models'
import { useUiStore } from '@/stores/ui'
import { useRepoTabCacheStore } from '@/stores/repoTabCache'

export interface RepoTab {
  path: string
  name: string
}

export const useRepoTabsStore = defineStore('repoTabs', {
  state: () => ({
    tabs: [] as RepoTab[],
    activePath: null as string | null,
  }),

  getters: {
    activeTab(state): RepoTab | null {
      return state.tabs.find((tab) => tab.path === state.activePath) ?? null
    },
  },

  actions: {
    hydrate(tabs: RepoTab[], activePath: string | null): void {
      this.tabs = tabs.map((tab) => ({ ...tab }))
      this.activePath = activePath
    },

    /** Keep tabs in sync with recent repositories so the tab bar matches the repo switcher. */
    syncFromRecent(recent: RecentRepository[]): void {
      let changed = false
      const paths = new Set(this.tabs.map((tab) => tab.path))
      for (const entry of recent) {
        if (paths.has(entry.path)) continue
        this.tabs.push({ path: entry.path, name: entry.name })
        paths.add(entry.path)
        changed = true
      }
      if (changed) this.persist()
    },

    addTab(path: string, name: string): void {
      const existing = this.tabs.find((tab) => tab.path === path)
      if (existing) {
        existing.name = name
      } else {
        this.tabs.push({ path, name })
      }
      this.activePath = path
      this.persist()
    },

    /** Removes a tab. Returns the path to switch to when the active tab was closed. */
    removeTab(path: string): string | null {
      const index = this.tabs.findIndex((tab) => tab.path === path)
      if (index === -1) return null

      const wasActive = this.activePath === path
      this.tabs.splice(index, 1)
      useRepoTabCacheStore().remove(path)

      if (!wasActive) {
        this.persist()
        return this.activePath
      }

      const next = this.tabs[index] ?? this.tabs[index - 1] ?? null
      this.activePath = next?.path ?? null
      this.persist()
      return next?.path ?? null
    },

    setActive(path: string): void {
      if (!this.tabs.some((tab) => tab.path === path)) return
      this.activePath = path
      this.persist()
    },

    clear(): void {
      this.tabs = []
      this.activePath = null
      useRepoTabCacheStore().clear()
      this.persist()
    },

    persist(): void {
      useUiStore().setOpenRepoTabs(this.tabs, this.activePath)
    },
  },
})
