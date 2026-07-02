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
    const result = await gitService.openRepository(tab.path, graphSnapshotOptions())
    if (!result.ok || !result.data) continue
    store.applySnapshot(result.data)
    cache.save(store)
  }

  const activeCached = cache.get(activePath)
  if (activeCached) {
    applyCachedTabState(store, activeCached)
  }
  await gitService.openRepository(activePath, graphSnapshotOptions())
}
