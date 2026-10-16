import { computed } from 'vue'
import { Check, FolderGit2, FolderOpen, FolderSearch, Plus } from '@lucide/vue'
import { open } from '@tauri-apps/plugin-dialog'
import type { MenuItem } from '@/components/ui/menu'
import { useRepositoryStore } from '@/stores/repository'
import { useRepoTabsStore } from '@/stores/repoTabs'
import { usePromptStore } from '@/stores/prompt'

async function pickFolder(): Promise<string | null> {
  try {
    const picked = await open({ directory: true, multiple: false })
    return typeof picked === 'string' ? picked : null
  } catch (err) {
    console.error('[git-light] folder pick failed:', err)
    return null
  }
}

export function useRepoMenu() {
  const repo = useRepositoryStore()
  const tabsStore = useRepoTabsStore()

  async function cloneRepository(): Promise<void> {
    const prompt = usePromptStore()
    const url = await prompt.prompt({
      title: 'Clone repository',
      message: 'Repository URL (https:// or git@host:). Auth uses your SSH keys or credential manager.',
      placeholder: 'https://github.com/org/repo.git',
      confirmLabel: 'Next',
    })
    if (!url) return
    const parentPath = await pickFolder()
    if (!parentPath) return
    await repo.cloneRepository({ url, parentPath })
  }

  async function initRepository(): Promise<void> {
    const folder = await pickFolder()
    if (!folder) return
    const prompt = usePromptStore()
    const branch = await prompt.prompt({
      title: 'Initialize repository',
      message: `Initial branch for ${folder} (empty uses the git default).`,
      placeholder: 'main',
      confirmLabel: 'Initialize',
    })
    if (branch === null) return
    await repo.initRepository({ path: folder, defaultBranch: branch || undefined })
  }

  async function scanFolder(): Promise<void> {
    const folder = await pickFolder()
    if (!folder) return
    const found = await repo.discoverRepositories(folder)
    if (found.length === 1 && found[0]) {
      await repo.openRepository(found[0].path)
    } else if (found.length > 1) {
      await repo.openRepository(found[0]?.path ?? folder)
    } else {
      await repo.openRepository(folder)
    }
  }

  const repoMenu = computed<MenuItem[]>(() => {
    const items: MenuItem[] = tabsStore.tabs.map((tab) => ({
      label: tab.name,
      icon: tab.path === tabsStore.activePath ? Check : FolderGit2,
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
