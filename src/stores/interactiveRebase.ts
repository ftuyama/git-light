import { defineStore } from 'pinia'
import type { RebaseCommitEntry, RebaseTodoAction, RebaseTodoLine } from '@shared/git/rebase'
import { localizedGitErrorMessage } from '@/lib/git/errorMessage'
import { gitService } from '@/lib/git'
import { translate } from '@/locales'
import { useRepositoryStore } from '@/stores/repository'
import { useSelectionStore } from '@/stores/selection'
import { useToastStore } from '@/stores/toast'

export interface RebasePlanEntry extends RebaseCommitEntry {
  action: RebaseTodoAction
  message: string
}

interface InteractiveRebaseState {
  isOpen: boolean
  base: string
  baseShortSha: string | null
  entries: RebasePlanEntry[]
  loading: boolean
  starting: boolean
  dragIndex: number | null
}

export const REBASE_ACTIONS: RebaseTodoAction[] = ['pick', 'reword', 'edit', 'squash', 'fixup', 'drop']

/** Catalog keys for the todo actions; `REBASE_ACTIONS` keeps the git order. */
export const REBASE_ACTION_LABEL_KEYS: Record<RebaseTodoAction, string> = {
  pick: 'rebase.actions.pick',
  reword: 'rebase.actions.reword',
  edit: 'rebase.actions.edit',
  squash: 'rebase.actions.squash',
  fixup: 'rebase.actions.fixup',
  drop: 'rebase.actions.drop',
}

export function rebaseActionLabel(action: RebaseTodoAction): string {
  return translate(REBASE_ACTION_LABEL_KEYS[action])
}

export const useInteractiveRebaseStore = defineStore('interactiveRebase', {
  state: (): InteractiveRebaseState => ({
    isOpen: false,
    base: 'HEAD~5',
    baseShortSha: null,
    entries: [],
    loading: false,
    starting: false,
    dragIndex: null,
  }),

  getters: {
  },

  actions: {
    open(fromCommitSha?: string): void {
      const repo = useRepositoryStore()
      if (!repo.hasOpenRepo) return

      if (fromCommitSha) {
        const commit = repo.commits.find((c) => c.sha === fromCommitSha || c.shortSha === fromCommitSha)
        if (commit?.parents[0]) {
          this.base = commit.parents[0]
        } else {
          this.base = `${fromCommitSha}^`
        }
      } else {
        const selectedSha = useSelectionStore().selectedSha
        const selected = selectedSha
          ? repo.commits.find((c) => c.sha === selectedSha)
          : undefined
        if (selected?.parents[0]) {
          this.base = selected.parents[0]
        } else {
          this.base = 'HEAD~5'
        }
      }

      this.baseShortSha = null
      this.entries = []
      this.isOpen = true
      void this.loadCommits()
    },

    /** Open the planner ending at an explicit base ref (e.g. a branch name). */
    openAtBase(base: string): void {
      const repo = useRepositoryStore()
      if (!repo.hasOpenRepo) return

      this.base = base
      this.baseShortSha = null
      this.entries = []
      this.isOpen = true
      void this.loadCommits()
    },

    close(): void {
      if (this.starting) return
      this.isOpen = false
      this.entries = []
      this.dragIndex = null
    },

    async loadCommits(): Promise<void> {
      const base = this.base.trim()
      if (!base) {
        useToastStore().push(translate('rebase.toast.baseRequired'), 'error')
        return
      }

      this.loading = true
      try {
        const result = await gitService.getRebaseCommits({ base })
        this.base = result.base
        this.baseShortSha = result.baseShortSha
        this.entries = result.commits.map((commit) => ({
          ...commit,
          action: 'pick' as const,
          message: commit.subject,
        }))
      } catch (error) {
        this.entries = []
        useToastStore().push(localizedGitErrorMessage(error), 'error')
      } finally {
        this.loading = false
      }
    },

    setBase(value: string): void {
      this.base = value
    },

    setAction(index: number, action: RebaseTodoAction): void {
      const entry = this.entries[index]
      if (!entry) return
      entry.action = action
      if (action === 'reword' && !entry.message) {
        entry.message = entry.subject
      }
    },

    setMessage(index: number, message: string): void {
      const entry = this.entries[index]
      if (!entry) return
      entry.message = message
    },

    moveEntry(from: number, to: number): void {
      if (from === to || from < 0 || to < 0 || from >= this.entries.length || to >= this.entries.length) {
        return
      }
      const [item] = this.entries.splice(from, 1)
      this.entries.splice(to, 0, item)
    },

    setDragIndex(index: number | null): void {
      this.dragIndex = index
    },

    async start(): Promise<void> {
      if (this.entries.length === 0) return

      const repo = useRepositoryStore()
      const lines: RebaseTodoLine[] = this.entries.map((entry) => ({
        sha: entry.sha,
        subject: entry.subject,
        action: entry.action,
        ...(entry.action === 'reword' ? { message: entry.message || entry.subject } : {}),
      }))

      this.starting = true
      try {
        const ok = await repo.runAction({
          kind: 'interactive-rebase',
          target: this.base,
          meta: { entries: lines },
        })
        if (ok) {
          this.isOpen = false
          this.entries = []
        }
      } finally {
        this.starting = false
      }
    },
  },
})
