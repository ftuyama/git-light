import { defineStore } from 'pinia'
import type { ExecutedGitCommand } from '@shared/git/models'
import type { GitAction } from '@/types/git'

export interface GitOutputEntry {
  id: number
  timestamp: number
  actionKind: string
  target?: string
  ok: boolean
  message: string
  commands: ExecutedGitCommand[]
}

let nextId = 1
const MAX_ENTRIES_PER_REPO = 100

export const useGitOutputStore = defineStore('gitOutput', {
  state: () => ({
    entriesByRepo: {} as Record<string, GitOutputEntry[]>,
    open: false,
  }),

  getters: {
    entriesFor:
      (state) =>
      (repoPath: string | null | undefined): GitOutputEntry[] => {
        if (!repoPath) return []
        return state.entriesByRepo[repoPath] ?? []
      },
  },

  actions: {
    log(repoPath: string | null | undefined, action: GitAction, result: { ok: boolean; message: string; commands?: ExecutedGitCommand[] }): void {
      if (!repoPath) return
      const entry: GitOutputEntry = {
        id: nextId++,
        timestamp: Date.now(),
        actionKind: action.kind,
        target: action.target,
        ok: result.ok,
        message: result.message,
        commands: result.commands ?? [],
      }
      const list = this.entriesByRepo[repoPath] ?? []
      list.push(entry)
      while (list.length > MAX_ENTRIES_PER_REPO) list.shift()
      this.entriesByRepo[repoPath] = list
    },

    clear(repoPath: string | null | undefined): void {
      if (!repoPath) return
      this.entriesByRepo[repoPath] = []
    },

    toggle(): void {
      this.open = !this.open
    },

    setOpen(open: boolean): void {
      this.open = open
    },
  },
})
