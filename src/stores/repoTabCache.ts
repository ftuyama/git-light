import { defineStore } from 'pinia'
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
  signOff: boolean
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
  | 'signOff'
  | 'amend'
>

export function captureTabState(store: CacheableStore): CachedTabState | null {
  if (!store.repository) return null
  return {
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
    signOff: store.signOff,
    amend: store.amend,
  }
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
  store.signOff = cached.signOff
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
