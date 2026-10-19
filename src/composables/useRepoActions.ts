import { useRepositoryStore } from '@/stores/repository'
import { useRepoTabsStore } from '@/stores/repoTabs'
import { useToastStore } from '@/stores/toast'

/**
 * Repository tab actions shared by the in-app UI (App.vue keybindings) and the
 * native menu. Plain functions so both call sites can invoke them on demand;
 * the stores are resolved lazily from the active Pinia instance.
 */

/** Switch to an open repository tab, surfacing failures as a toast. */
export async function switchToRepositoryTab(path: string | null): Promise<void> {
  if (!path) return
  try {
    const ok = await useRepositoryStore().switchRepository(path)
    if (!ok) useToastStore().push(`Could not open ${path}.`, 'error')
  } catch (err) {
    console.error('[git-light] switch tab failed:', err)
    useToastStore().push(`Could not open ${path}.`, 'error')
  }
}

/** Close the active tab, falling back to the next tab or the startup screen. */
export async function closeActiveRepositoryTab(): Promise<void> {
  const repo = useRepositoryStore()
  const tabsStore = useRepoTabsStore()
  const active = tabsStore.activePath
  if (!active) return
  const nextPath = tabsStore.removeTab(active)
  void repo.removeRecent(active)
  if (nextPath) await switchToRepositoryTab(nextPath)
  else await repo.closeRepository()
}

/** Restore the most recently closed tab and activate it. */
export async function reopenClosedRepositoryTab(): Promise<void> {
  const restored = useRepoTabsStore().reopenLastClosed()
  if (!restored) return
  await switchToRepositoryTab(restored.path)
}
