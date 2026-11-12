import { defineStore } from 'pinia'
import type { RecentRepository } from '@shared/git/models'
import { useUiStore } from '@/stores/ui'
import { useRepoTabCacheStore } from '@/stores/repoTabCache'

export interface RepoTab {
  path: string
  name: string
  /** Optional display name that overrides `name` in the tab bar. */
  alias?: string
}

const MAX_CLOSED_TABS = 25

export const useRepoTabsStore = defineStore('repoTabs', {
  state: () => ({
    tabs: [] as RepoTab[],
    activePath: null as string | null,
    closedStack: [] as RepoTab[],
  }),

  getters: {
    activeTab(state): RepoTab | null {
      return state.tabs.find((tab) => tab.path === state.activePath) ?? null
    },
    activeIndex(state): number {
      return state.tabs.findIndex((tab) => tab.path === state.activePath)
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
      const [removed] = this.tabs.splice(index, 1)
      if (removed) {
        this.closedStack.push({ ...removed })
        if (this.closedStack.length > MAX_CLOSED_TABS) this.closedStack.shift()
      }
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

    /**
     * Close every tab except `target`, making `target` active. Returns the
     * removed paths so callers can prune their recent-repository entries.
     */
    closeOtherTabs(target: string): string[] {
      if (!this.tabs.some((tab) => tab.path === target)) return []
      const paths = this.tabs.filter((tab) => tab.path !== target).map((tab) => tab.path)
      return this.closeManyTabs(paths, target)
    },

    /** Close every tab to the right of `target`. Returns the removed paths. */
    closeTabsToRight(target: string): string[] {
      const index = this.tabs.findIndex((tab) => tab.path === target)
      if (index === -1) return []
      return this.closeManyTabs(
        this.tabs.slice(index + 1).map((tab) => tab.path),
        target,
      )
    },

    /** Remove several tabs and activate `activatePath` when it survives. */
    closeManyTabs(paths: string[], activatePath?: string | null): string[] {
      const removed: string[] = []
      for (const path of paths) {
        if (!this.tabs.some((tab) => tab.path === path)) continue
        this.removeTab(path)
        removed.push(path)
      }

      if (
        activatePath &&
        this.activePath !== activatePath &&
        this.tabs.some((tab) => tab.path === activatePath)
      ) {
        this.activePath = activatePath
        this.persist()
      }
      return removed
    },

    /** Set (or clear, with `null`) a tab's display alias. */
    setAlias(path: string, alias: string | null): void {
      const tab = this.tabs.find((item) => item.path === path)
      if (!tab) return

      const next = alias?.trim() ?? ''
      if (!next || next === tab.name) delete tab.alias
      else tab.alias = next
      this.persist()
    },

    /** Apply an explicit tab order. Unknown paths are ignored and omitted tabs are appended. */
    reorderTabs(paths: string[]): void {
      const byPath = new Map(this.tabs.map((tab) => [tab.path, tab]))
      const next: RepoTab[] = []

      for (const path of paths) {
        const tab = byPath.get(path)
        if (!tab) continue
        next.push(tab)
        byPath.delete(path)
      }
      for (const tab of this.tabs) {
        if (byPath.has(tab.path)) next.push(tab)
      }
      if (next.length !== this.tabs.length) return
      if (next.every((tab, index) => tab.path === this.tabs[index]?.path)) return

      this.tabs = next
      this.persist()
    },

    /** Pop the most recently closed tab (browser-style restore). */
    reopenLastClosed(): RepoTab | null {
      const tab = this.closedStack.pop() ?? null
      if (!tab) return null
      if (!this.tabs.some((t) => t.path === tab.path)) {
        this.tabs.push({ ...tab })
      }
      this.activePath = tab.path
      this.persist()
      return { ...tab }
    },

    peekClosed(): RepoTab | null {
      return this.closedStack.length > 0 ? { ...this.closedStack[this.closedStack.length - 1] } : null
    },

    /** Cycle to the next/previous tab in visual index order. Returns new active path. */
    cycleTab(delta: 1 | -1): string | null {
      if (this.tabs.length === 0) return null
      const current = this.tabs.findIndex((tab) => tab.path === this.activePath)
      const base = current === -1 ? (delta === 1 ? -1 : 0) : current
      const next = (base + delta + this.tabs.length) % this.tabs.length
      this.activePath = this.tabs[next].path
      this.persist()
      return this.activePath
    },

    /** Switch to tab by 0-based index. Out of range returns null. */
    switchToIndex(index: number): string | null {
      if (index < 0 || index >= this.tabs.length) return null
      this.activePath = this.tabs[index].path
      this.persist()
      return this.activePath
    },

    /** Switch to the last tab (⌘9 convention). */
    switchToLast(): string | null {
      if (this.tabs.length === 0) return null
      return this.switchToIndex(this.tabs.length - 1)
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
