import { gitService } from '@/lib/git'
import type { CommitPageInfo } from '@shared/git/models'
import { graphSnapshotOptions } from './refreshScheduler'
import { buildGraphLayout } from './graphLayout'
import { syncBranchLaneColors } from '@/lib/graph/syncBranchLaneColors'
import { MAX_CACHED_TABS, useRepoTabCacheStore, type CachedTabState } from '@/stores/repoTabCache'
import type { RepoTab } from '@/stores/repoTabs'
import type { RepositoryState } from './types'
import type { RepositoryData } from '@/types/git'

type PreloadStore = RepositoryState & {
  applySnapshot(data: RepositoryData): void
}

/**
 * Tabs warmed per run. Matches the cache capacity: anything beyond it would be
 * evicted before the user could click it.
 */
const MAX_PRELOAD_TABS = MAX_CACHED_TABS

/**
 * Snapshots built at once. Two keeps a cold tab reachable in ~1 round-trip
 * while staying gentle on `git` for huge repositories.
 */
const PRELOAD_CONCURRENCY = 2

/** Paths currently being warmed, so hover + startup cannot fetch twice. */
const inFlight = new Set<string>()

import { headCommitIndex } from '@/lib/graph/pendingGraphRow'

function toCachedEntry(data: RepositoryData, page: CommitPageInfo): CachedTabState | null {
  if (!data.repository) return null
  const headIndex = headCommitIndex(data.commits, data.repository.headSha)
  const layout = buildGraphLayout(data.commits, headIndex)
  return {
    path: data.repository.path,
    repository: { ...data.repository },
    commits: [...data.commits],
    commitPage: { ...page },
    branches: syncBranchLaneColors([...data.branches], data.commits, layout),
    tags: [...data.tags],
    stashes: [...data.stashes],
    worktrees: [...data.worktrees],
    workingTree: [...data.workingTree],
    layout,
    commitAuthor: data.commitAuthor ? { ...data.commitAuthor } : null,
    commitMessage: '',
    commitDescription: '',
    amend: false,
    savedAt: Date.now(),
  }
}

/**
 * Fetches one tab into a cache entry. Prefers `preloadRepository`, which never
 * re-points the backend; older/other backends fall back to `openRepository`
 * and the caller re-activates the visible repo afterwards.
 */
async function fetchEntry(
  path: string,
): Promise<{ entry: CachedTabState | null; rePointed: boolean }> {
  if (typeof gitService.preloadRepository === 'function') {
    const result = await gitService.preloadRepository(path, graphSnapshotOptions())
    if (!result.ok || !result.data) return { entry: null, rePointed: false }
    return { entry: toCachedEntry(result.data, result.page ?? emptyPage()), rePointed: false }
  }
  const result = await gitService.openRepository(path, graphSnapshotOptions())
  if (!result.ok || !result.data) return { entry: null, rePointed: false }
  return { entry: toCachedEntry(result.data, gitService.commitPage), rePointed: true }
}

function emptyPage(): CommitPageInfo {
  return { oldestSha: null, hasMore: false, total: null }
}

/**
 * Warms a single tab in the background. Safe to call repeatedly (hover,
 * startup): cached and in-flight paths are skipped.
 */
export async function preloadTabInBackground(path: string): Promise<void> {
  const cache = useRepoTabCacheStore()
  if (cache.has(path) || inFlight.has(path)) return
  inFlight.add(path)
  try {
    const { entry } = await fetchEntry(path)
    if (entry) cache.set(entry)
  } catch (err) {
    console.error(`[git-light] tab preload failed for ${path}:`, err)
  } finally {
    inFlight.delete(path)
  }
}

export async function preloadSavedTabs(
  store: PreloadStore,
  tabs: RepoTab[],
  activePath: string,
): Promise<void> {
  const cache = useRepoTabCacheStore()
  try {
    cache.save(store)
  } catch (err) {
    console.error('[git-light] tab preload cache save failed:', err)
  }

  // Preload inactive tabs directly into the cache without touching the live
  // store: applying every snapshot to `store` would thrash the visible UI and
  // rebuild the graph layout N times.
  const pending = tabs
    .filter((tab) => tab.path !== activePath && !cache.has(tab.path))
    .slice(0, MAX_PRELOAD_TABS)
    .map((tab) => tab.path)

  let rePointed = false
  for (let i = 0; i < pending.length; i += PRELOAD_CONCURRENCY) {
    const batch = pending.slice(i, i + PRELOAD_CONCURRENCY)
    await Promise.all(
      batch.map(async (path) => {
        if (inFlight.has(path)) return
        inFlight.add(path)
        try {
          const result = await fetchEntry(path)
          if (result.entry) cache.set(result.entry)
          rePointed ||= result.rePointed
        } catch (err) {
          console.error(`[git-light] tab preload failed for ${path}:`, err)
        } finally {
          inFlight.delete(path)
        }
      }),
    )
  }

  // Only older backends re-point `current` while preloading; re-align them with
  // the repo on screen or later watcher events / diffs would target the last
  // preloaded tab.
  const visiblePath = store.repository?.path
  if (rePointed && visiblePath && typeof gitService.activateRepository === 'function') {
    try {
      await gitService.activateRepository(visiblePath)
    } catch (err) {
      console.error('[git-light] tab preload activation failed:', err)
    }
  }
}
