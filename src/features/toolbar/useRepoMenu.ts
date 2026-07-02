import { computed } from 'vue'
import { Check, FolderGit2, FolderOpen } from '@lucide/vue'
import type { MenuItem } from '@/components/ui/menu'
import { useRepositoryStore } from '@/stores/repository'
import { useRepoTabsStore } from '@/stores/repoTabs'

export function useRepoMenu() {
  const repo = useRepositoryStore()
  const tabsStore = useRepoTabsStore()

  const repoMenu = computed<MenuItem[]>(() => {
    const items: MenuItem[] = tabsStore.tabs.map((tab) => ({
      label: tab.name,
      icon: tab.path === tabsStore.activePath ? Check : FolderGit2,
      onSelect: () => void repo.switchRepository(tab.path),
    }))

    if (items.length > 0) items.push({ separator: true })
    items.push(
      { label: 'Open Repository…', icon: FolderOpen, onSelect: () => void repo.pickAndOpenRepository() },
      { label: 'Close Repository', onSelect: () => void repo.closeRepository() },
    )
    return items
  })

  return { repoMenu }
}
