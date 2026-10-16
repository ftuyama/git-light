import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import type { CommitPageInfo } from '@shared/git/models'
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
}

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
 * Recursively strips Vue reactivity (`reactive`/`ref` proxies) so the result
 * can be handed to `structuredClone`. `structuredClone` throws
 * `DataCloneError` on reactive proxies, which previously made every
 * `cache.save()` — and therefore every tab switch — fail.
 * Plain objects/arrays are rebuilt; class instances (e.g. `Date`) are passed
 * through untouched for `structuredClone` to clone natively.
 */
function deepToRaw<T>(value: T): T {
  const raw = toRaw(value)
  if (Array.isArray(raw)) return raw.map(deepToRaw) as unknown as T
  if (raw !== null && typeof raw === 'object') {
    const proto: unknown = Object.getPrototypeOf(raw)
    if (proto === Object.prototype || proto === null) {
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(raw)) {
        out[key] = deepToRaw((raw as Record<string, unknown>)[key])
      }
      return out as unknown as T
    }
  }
  return raw
}

export function captureTabState(store: CacheableStore): CachedTabState | null {
  if (!store.repository) return null
  // Deep-clone: the cache must own its data. Storing live array/object refs
  // means mutating the active repo (e.g. a refresh) also mutates the cache.
  // `structuredClone` preserves Dates. Reactivity is stripped first via
  // `deepToRaw` — cloning a reactive proxy throws `DataCloneError`.
  const snapshot = {
    path: store.repository.path,
    repository: store.repository,
    commits: store.commits,
    commitPage: { ...store.commitPage },
    branches: store.branches,
    tags: store.tags,
    stashes: store.stashes,
    worktrees: store.worktrees,
    workingTree: store.workingTree,
    layout: store.layout,
    commitAuthor: store.commitAuthor,
    commitMessage: store.commitMessage,
    commitDescription: store.commitDescription,
    amend: store.amend,
  }
  return structuredClone(deepToRaw(snapshot))
}

export function applyCachedTabState(store: CacheableStore, cached: CachedTabState): void {
  store.repository = cached.repository
  store.commits = cached.commits
  store.commitPage = { ...cached.commitPage }
  store.branches = cached.branches
  store.tags = cached.tags
  store.stashes = cached.stashes
  store.worktrees = cached.worktrees
  store.workingTree = cached.workingTree
  store.layout = cached.layout
  store.commitAuthor = cached.commitAuthor
  store.commitMessage = cached.commitMessage
  store.commitDescription = cached.commitDescription
  store.amend = cached.amend
}

export const useRepoTabCacheStore = defineStore('repoTabCache', {
  state: () => ({
    byPath: {} as Record<string, CachedTabState>,
  }),

  actions: {
    has(path: string): boolean {
      return path in this.byPath
    },

    get(path: string): CachedTabState | undefined {
      return this.byPath[path]
    },

    save(store: CacheableStore): void {
      const snapshot = captureTabState(store)
      if (!snapshot) return
      this.byPath[snapshot.path] = snapshot
    },

    remove(path: string): void {
      delete this.byPath[path]
    },

    clear(): void {
      this.byPath = {}
    },
  },
})
