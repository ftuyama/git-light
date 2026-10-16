import { gitService } from '@/lib/git'
import { graphSnapshotOptions } from './refreshScheduler'
import { applyCachedTabState, useRepoTabCacheStore } from '@/stores/repoTabCache'
import type { RepoTab } from '@/stores/repoTabs'
import type { RepositoryState } from './types'

type PreloadStore = RepositoryState & {
  applySnapshot(data: import('@/types/git').RepositoryData): void
}

export async function preloadSavedTabs(
  store: PreloadStore,
  tabs: RepoTab[],
  activePath: string,
): Promise<void> {
  const cache = useRepoTabCacheStore()
  cache.save(store)

  for (const tab of tabs) {
    if (tab.path === activePath) continue
    try {
      const result = await gitService.openRepository(tab.path, graphSnapshotOptions())
      if (!result.ok || !result.data) continue
      store.applySnapshot(result.data)
      try {
        cache.save(store)
      } catch (err) {
        console.error('[git-light] tab preload cache save failed:', err)
      }
    } catch (err) {
      console.error(`[git-light] tab preload failed for ${tab.path}:`, err)
    }
  }

  const activeCached = cache.get(activePath)
  if (activeCached) {
    applyCachedTabState(store, activeCached)
  }
  try {
    await gitService.openRepository(activePath, graphSnapshotOptions())
  } catch (err) {
    console.error('[git-light] tab preload refresh failed:', err)
  }
}
