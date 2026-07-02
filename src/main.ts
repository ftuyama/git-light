import { createApp } from 'vue'
import { createPinia } from 'pinia'
import type { RecentRepository } from '@shared/git/models'
import App from './App.vue'
import { syncThemePreference } from './lib/applyTheme'
import { useUiStore } from './stores/ui'
import { useRepositoryStore } from './stores/repository'
import { useRepoTabsStore } from './stores/repoTabs'
import { preloadSavedTabs } from './stores/repo/tabPreload'
import 'splitpanes/dist/splitpanes.css'
import '@xterm/xterm/css/xterm.css'
import './assets/theme.css'

function startupRepositoryCandidates(
  tabs: { path: string }[],
  lastPath: string | null,
  recentRepos: RecentRepository[],
): string[] {
  const candidates: string[] = []
  if (lastPath) candidates.push(lastPath)
  for (const tab of tabs) {
    if (!candidates.includes(tab.path)) candidates.push(tab.path)
  }
  for (const item of [...recentRepos].sort((a, b) => b.lastOpened - a.lastOpened)) {
    if (!candidates.includes(item.path)) candidates.push(item.path)
  }
  return candidates
}

async function restoreSession(
  lastPath: string | null,
  tabs: { path: string }[],
  recentRepos: RecentRepository[],
  open: (path: string) => Promise<boolean>,
): Promise<string | null> {
  for (const path of startupRepositoryCandidates(tabs, lastPath, recentRepos)) {
    if (await open(path)) return path
  }
  return null
}

async function bootstrap(): Promise<void> {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  const ui = useUiStore(pinia)
  await ui.hydrate()
  syncThemePreference(ui.theme)

  const tabs = useRepoTabsStore(pinia)
  tabs.hydrate(ui.openRepoTabs, ui.lastRepositoryPath)

  const repo = useRepositoryStore(pinia)
  await repo.init()
  tabs.syncFromRecent(repo.recentRepos)

  const useMock =
    import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true' && typeof repo.loadMock === 'function'
  if (useMock) {
    void repo.loadMock()
  } else {
    const openedPath = await restoreSession(
      tabs.activePath ?? ui.lastRepositoryPath,
      tabs.tabs,
      repo.recentRepos,
      (path) => repo.openRepository(path, { silent: true }),
    )
    if (openedPath) {
      ui.setLastRepositoryPath(openedPath)
      tabs.setActive(openedPath)
      if (tabs.tabs.length > 1) {
        void preloadSavedTabs(repo, tabs.tabs, openedPath)
      }
    } else if (ui.lastRepositoryPath) {
      ui.setLastRepositoryPath(null)
    }
  }

  app.mount('#app')
}

void bootstrap()
