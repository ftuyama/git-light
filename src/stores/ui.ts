import { defineStore } from 'pinia'

const STORE_KEY = 'git-light:ui'

interface PersistedUiState {
  leftSize: number
  rightSize: number
  leftCollapsed: boolean
  rightCollapsed: boolean
  sections: Record<string, boolean>
}

const DEFAULT_SECTIONS: Record<string, boolean> = {
  localBranches: true,
  remoteBranches: true,
  tags: true,
  stashes: true,
  worktrees: false,
}

async function readPersisted(): Promise<PersistedUiState | null> {
  if (window.electron?.store) {
    return window.electron.store.get<PersistedUiState | null>(STORE_KEY, null)
  }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as PersistedUiState) : null
  } catch {
    return null
  }
}

function writePersisted(state: PersistedUiState): void {
  if (window.electron?.store) {
    void window.electron.store.set(STORE_KEY, state)
    return
  }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export const useUiStore = defineStore('ui', {
  state: () => ({
    leftSize: 18,
    rightSize: 24,
    leftCollapsed: false,
    rightCollapsed: false,
    sections: { ...DEFAULT_SECTIONS },
    commandPaletteOpen: false,
  }),
  actions: {
    async hydrate(): Promise<void> {
      const saved = await readPersisted()
      if (saved) {
        this.leftSize = saved.leftSize ?? this.leftSize
        this.rightSize = saved.rightSize ?? this.rightSize
        this.leftCollapsed = saved.leftCollapsed ?? false
        this.rightCollapsed = saved.rightCollapsed ?? false
        this.sections = { ...DEFAULT_SECTIONS, ...(saved.sections ?? {}) }
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      this.$subscribe(() => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          writePersisted({
            leftSize: this.leftSize,
            rightSize: this.rightSize,
            leftCollapsed: this.leftCollapsed,
            rightCollapsed: this.rightCollapsed,
            sections: this.sections,
          })
        }, 200)
      })
    },
    setLeftSize(size: number): void {
      this.leftSize = size
    },
    setRightSize(size: number): void {
      this.rightSize = size
    },
    toggleLeft(): void {
      this.leftCollapsed = !this.leftCollapsed
    },
    toggleRight(): void {
      this.rightCollapsed = !this.rightCollapsed
    },
    toggleSection(key: string): void {
      this.sections[key] = !this.sections[key]
    },
    isSectionOpen(key: string): boolean {
      return this.sections[key] ?? true
    },
  },
})
