import { computed } from 'vue'
import { Check, FolderGit2, FolderOpen, FolderSearch, Plus } from '@lucide/vue'
import type { MenuItem } from '@/components/ui/menu'
import { useRepositoryStore } from '@/stores/repository'
import { useRepoTabsStore } from '@/stores/repoTabs'
import { preloadTabInBackground } from '@/stores/repo/tabPreload'
import { cloneRepository, initRepository, scanFolder } from '@/lib/tauri/repoCommands'

export function useRepoMenu() {
  const repo = useRepositoryStore()
  const tabsStore = useRepoTabsStore()

  const repoMenu = computed<MenuItem[]>(() => {
    const items: MenuItem[] = tabsStore.tabs.map((tab) => ({
      label: tab.name,
      icon: tab.path === tabsStore.activePath ? Check : FolderGit2,
      // Warm the tab while the pointer is still over the menu row, so a click
      // that follows finds it cached (a no-op when it already is).
      onHover: () => void preloadTabInBackground(tab.path),
      onSelect: () => void repo.switchRepository(tab.path),
    }))

    if (items.length > 0) items.push({ separator: true })
    items.push(
      { label: 'Open Repository…', icon: FolderOpen, onSelect: () => void repo.pickAndOpenRepository() },
      { label: 'Clone Repository…', icon: FolderGit2, onSelect: () => void cloneRepository() },
      { label: 'Initialize Repository…', icon: Plus, onSelect: () => void initRepository() },
      { label: 'Find Repositories in Folder…', icon: FolderSearch, onSelect: () => void scanFolder() },
      { label: 'Close Repository', onSelect: () => void repo.closeRepository() },
    )
    return items
  })

  return { repoMenu }
}
