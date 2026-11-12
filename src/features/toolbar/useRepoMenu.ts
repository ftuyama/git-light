import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, FolderGit2, FolderOpen, FolderSearch, Plus } from '@lucide/vue'
import type { MenuItem } from '@/components/ui/menu'
import { useRepositoryStore } from '@/stores/repository'
import { useRepoTabsStore } from '@/stores/repoTabs'
import { preloadTabInBackground } from '@/stores/repo/tabPreload'
import { cloneRepository, initRepository, scanFolder } from '@/lib/tauri/repoCommands'

export function useRepoMenu() {
  const repo = useRepositoryStore()
  const tabsStore = useRepoTabsStore()
  const { t } = useI18n()

  /** Actions offered by the "new tab" button in the tab strip. */
  const newTabMenu = computed<MenuItem[]>(() => [
    { label: t('shell.startup.openRepository'), icon: FolderOpen, onSelect: () => void repo.pickAndOpenRepository() },
    { label: t('shell.newTab.clone'), icon: FolderGit2, onSelect: () => void cloneRepository() },
    { label: t('shell.newTab.init'), icon: Plus, onSelect: () => void initRepository() },
    { label: t('shell.newTab.findInFolder'), icon: FolderSearch, onSelect: () => void scanFolder() },
  ])

  const repoMenu = computed<MenuItem[]>(() => {
    const items: MenuItem[] = tabsStore.tabs.map((tab) => ({
      label: tab.alias ?? tab.name,
      icon: tab.path === tabsStore.activePath ? Check : FolderGit2,
      // Warm the tab while the pointer is still over the menu row, so a click
      // that follows finds it cached (a no-op when it already is).
      onHover: () => void preloadTabInBackground(tab.path),
      onSelect: () => void repo.switchRepository(tab.path),
    }))

    if (items.length > 0) items.push({ separator: true })
    items.push(
      ...newTabMenu.value,
      { label: t('shell.newTab.closeRepository'), onSelect: () => void repo.closeRepository() },
    )
    return items
  })

  return { repoMenu, newTabMenu }
}
