import { gitService } from '@/lib/git'
import { graphSnapshotOptions } from './refreshScheduler'
import { buildGraphLayout } from './graphLayout'
import { syncBranchLaneColors } from '@/lib/graph/syncBranchLaneColors'
import { useRepoTabCacheStore, type CachedTabState } from '@/stores/repoTabCache'
import type { RepoTab } from '@/stores/repoTabs'
import type { RepositoryState } from './types'
import type { RepositoryData } from '@/types/git'

type PreloadStore = RepositoryState & {
  applySnapshot(data: RepositoryData): void
}

/** Snapshot options used for background tab preloads. */
const MAX_PRELOAD_TABS = 8

import { headCommitIndex } from '@/lib/graph/pendingGraphRow'

function toCachedEntry(data: RepositoryData): CachedTabState | null {
  if (!data.repository) return null
  const headIndex = headCommitIndex(data.commits, data.repository.headSha)
  const layout = buildGraphLayout(data.commits, headIndex)
  return {
    path: data.repository.path,
    repository: { ...data.repository },
    commits: [...data.commits],
    commitPage: { ...gitService.commitPage },
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
  // store: the previous implementation applied every snapshot to `store`,
  // thrashing the visible UI and rebuilding the graph layout N times.
  let preloaded = 0
  for (const tab of tabs) {
    if (tab.path === activePath) continue
    if (cache.has(tab.path)) continue
    if (preloaded >= MAX_PRELOAD_TABS) break
    try {
      const result = await gitService.openRepository(tab.path, graphSnapshotOptions())
      if (!result.ok || !result.data) continue
      const entry = toCachedEntry(result.data)
      if (entry) cache.set(entry)
      preloaded += 1
    } catch (err) {
      console.error(`[git-light] tab preload failed for ${tab.path}:`, err)
    }
  }
}
