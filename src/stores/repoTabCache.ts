import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import type { CommitPageInfo } from '@shared/git/models'
import { normalizeRepoPath } from '@/lib/git/repoPath'
import type {
  Author,
  Branch,
  Commit,
  Repository,
  Stash,
  Tag,
  WorkingTreeFile,
  Worktree,
} from '@/types/git'
import type { GraphLayout } from '@/lib/graph/computeGraphLayout'
import type { RepositoryState } from './repo/types'

export interface CachedTabState {
  path: string
  repository: Repository
  commits: Commit[]
  commitPage: CommitPageInfo
  branches: Branch[]
  tags: Tag[]
  stashes: Stash[]
  worktrees: Worktree[]
  workingTree: WorkingTreeFile[]
  layout: GraphLayout
  commitAuthor: Author | null
  commitMessage: string
  commitDescription: string
  amend: boolean
  /** Epoch ms of the last successful save; used to skip aggressive revalidation. */
  savedAt: number
}

/** Upper bound for in-memory tab snapshots; oldest entries are evicted first. */
export const MAX_CACHED_TABS = 10

type CacheableStore = Pick<
  RepositoryState,
  | 'repository'
  | 'commits'
  | 'commitPage'
  | 'branches'
  | 'tags'
  | 'stashes'
  | 'worktrees'
  | 'workingTree'
  | 'layout'
  | 'commitAuthor'
  | 'commitMessage'
  | 'commitDescription'
  | 'amend'
>

/**
 * Shallow snapshot of the active repo. All store updates replace top-level
 * arrays wholesale (`this.commits = data.commits`) instead of mutating them
 * in place, so sharing nested commit/branch objects with the cache is safe
 * and avoids a full `structuredClone` of thousands of rows on every tab
 * switch. Only Vue reactivity proxies are unwrapped via `toRaw`.
 */
export function captureTabState(store: CacheableStore): CachedTabState | null {
  if (!store.repository) return null
  const layout = toRaw(store.layout)
  const laneState = layout.laneState ? { lanes: [...layout.laneState.lanes] } : undefined
  return {
    path: toRaw(store.repository).path,
    repository: { ...toRaw(store.repository) },
    commits: [...toRaw(store.commits)],
    commitPage: { ...toRaw(store.commitPage) },
    branches: [...toRaw(store.branches)],
    tags: [...toRaw(store.tags)],
    stashes: [...toRaw(store.stashes)],
    worktrees: [...toRaw(store.worktrees)],
    workingTree: [...toRaw(store.workingTree)],
    layout: {
      nodes: [...toRaw(layout.nodes)],
      bands: [...toRaw(layout.bands)],
      maxLanes: layout.maxLanes,
      ...(laneState ? { laneState } : {}),
    },
    commitAuthor: store.commitAuthor ? { ...toRaw(store.commitAuthor) } : null,
    commitMessage: store.commitMessage,
    commitDescription: store.commitDescription,
    amend: store.amend,
    savedAt: Date.now(),
  }
}

export function applyCachedTabState(store: CacheableStore, cached: CachedTabState): void {
  // Batch into a single Pinia notification instead of ~13 sequential
  // reactive updates that each re-trigger graph/sidebar/file-list computeds.
  const patch = {
    repository: cached.repository,
    commits: cached.commits,
    commitPage: { ...cached.commitPage },
    branches: cached.branches,
    tags: cached.tags,
    stashes: cached.stashes,
    worktrees: cached.worktrees,
    workingTree: cached.workingTree,
    layout: cached.layout,
    commitAuthor: cached.commitAuthor,
    commitMessage: cached.commitMessage,
    commitDescription: cached.commitDescription,
    amend: cached.amend,
  }
  const maybePatchable = store as CacheableStore & {
    $patch?: (patch: Partial<CacheableStore>) => void
  }
  if (typeof maybePatchable.$patch === 'function') {
    maybePatchable.$patch(patch)
    return
  }
  Object.assign(store, patch)
}

export const useRepoTabCacheStore = defineStore('repoTabCache', {
  state: () => ({
    byPath: {} as Record<string, CachedTabState>,
  }),

  actions: {
    /**
     * Resolve a lookup path against the stored keys, tolerating the spelling
     * differences the backend canonicalizes away (trailing slash, macOS
     * `/private` prefix, case). Without this a tab saved under its canonical
     * path would be invisible when looked up by the raw picked path.
     */
    resolveKey(path: string): string | undefined {
      if (path in this.byPath) return path
      const target = normalizeRepoPath(path).toLowerCase()
      return Object.keys(this.byPath).find(
        (key) => normalizeRepoPath(key).toLowerCase() === target,
      )
    },

    has(path: string): boolean {
      return this.resolveKey(path) !== undefined
    },

    get(path: string): CachedTabState | undefined {
      const key = this.resolveKey(path) ?? path
      const entry = this.byPath[key]
      if (entry) {
        // Refresh LRU order + timestamp so frequently visited tabs survive.
        delete this.byPath[key]
        this.byPath[key] = entry
      }
      return entry
    },

    /** Insert a prebuilt snapshot (e.g. background preload) with eviction. */
    set(entry: CachedTabState): void {
      delete this.byPath[entry.path]
      this.byPath[entry.path] = entry
      this.evictIfNeeded(entry.path)
    },

    save(store: CacheableStore): void {
      const snapshot = captureTabState(store)
      if (!snapshot) return
      this.set(snapshot)
    },

    /** Evict oldest entries beyond the cap; never evicts `exceptPath`. */
    evictIfNeeded(exceptPath?: string): void {
      const keys = Object.keys(this.byPath)
      if (keys.length <= MAX_CACHED_TABS) return
      for (const key of keys) {
        if (Object.keys(this.byPath).length <= MAX_CACHED_TABS) break
        if (key === exceptPath) continue
        delete this.byPath[key]
      }
    },

    remove(path: string): void {
      delete this.byPath[path]
    },

    clear(): void {
      this.byPath = {}
    },
  },
})
