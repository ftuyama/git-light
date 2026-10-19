import { createApp } from 'vue'
import { createPinia } from 'pinia'
import type { RecentRepository } from '@shared/git/models'
import { isTauri } from '@/lib/backend'
import { useMockGitServiceIfRequested } from '@/lib/git'
import App from './App.vue'
import { syncThemePreference } from './lib/applyTheme'
import { useUiStore } from './stores/ui'
import { useRepositoryStore } from './stores/repository'
import { useRepoTabsStore } from './stores/repoTabs'
import { preloadSavedTabs } from './stores/repo/tabPreload'
import { attachPerfToTerminal } from '@/lib/tauri/perfBridge'
import 'splitpanes/dist/splitpanes.css'
import 'file-icons-js/css/style.css'
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
    try {
      if (await open(path)) return path
    } catch (err) {
      console.error(`[git-light] failed to restore ${path}:`, err)
    }
  }
  return null
}

async function bootstrap(): Promise<void> {
  // Diagnostics first: everything below (session restore, first snapshot,
  // tab preloading) emits perf samples, and the terminal bridge is what makes
  // them visible outside devtools.
  attachPerfToTerminal()

  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.config.errorHandler = (err) => console.error('[git-light] render error:', err)

  // Mount first so a backend/startup failure can never leave a black screen:
  // the default store state renders StartupView.
  app.mount('#app')

  let useMock = false
  try {
    useMock = await useMockGitServiceIfRequested()
  } catch (err) {
    console.error('[git-light] mock backend setup failed:', err)
  }

  const ui = useUiStore(pinia)
  try {
    await ui.hydrate()
  } catch (err) {
    console.error('[git-light] UI prefs hydrate failed:', err)
  }
  try {
    syncThemePreference(ui.theme)
  } catch (err) {
    console.error('[git-light] theme sync failed:', err)
  }

  const tabs = useRepoTabsStore(pinia)
  try {
    tabs.hydrate(ui.openRepoTabs, ui.lastRepositoryPath)
  } catch (err) {
    console.error('[git-light] tabs hydrate failed:', err)
  }

  const repo = useRepositoryStore(pinia)
  try {
    await repo.init()
  } catch (err) {
    console.error('[git-light] backend init failed (is the Tauri IPC reachable?):', err)
    // No backend, no restore: fall back to the startup picker instead of
    // leaving the restore splash on screen forever.
    repo.screen = 'startup'
    return
  }
  try {
    tabs.syncFromRecent(repo.recentRepos)
  } catch (err) {
    console.error('[git-light] tabs sync failed:', err)
  }

  if (useMock && typeof repo.loadMock === 'function') {
    try {
      await repo.loadMock()
    } catch (err) {
      console.error('[git-light] mock load failed:', err)
      repo.screen = 'startup'
    }
  } else {
    let openedPath: string | null = null
    try {
      openedPath = await restoreSession(
        tabs.activePath ?? ui.lastRepositoryPath,
        tabs.tabs,
        repo.recentRepos,
        (path) => repo.openRepository(path, { silent: true }),
      )
    } catch (err) {
      console.error('[git-light] session restore failed:', err)
    }
    if (openedPath) {
      ui.setLastRepositoryPath(openedPath)
      tabs.setActive(openedPath)
      if (tabs.tabs.length > 1) {
        // Warm the other tabs after the visible repository has painted: doing
        // it inline competes with the first snapshot for git processes.
        const visiblePath = openedPath
        window.setTimeout(() => void preloadSavedTabs(repo, tabs.tabs, visiblePath), 500)
      }
    } else {
      if (ui.lastRepositoryPath) ui.setLastRepositoryPath(null)
      // Nothing restorable: this is a genuine first open, so show the picker.
      repo.screen = 'startup'
    }
  }

  // Safety net: any path that neither opened a repository nor reached the
  // startup screen must not strand the user on the restore splash.
  if (repo.screen === 'restoring' && !repo.repository) repo.screen = 'startup'

  if (isTauri()) {
    // Startup update check (3s delay, snooze-aware).
    window.setTimeout(() => {
      void import('@/lib/tauri/updateCheck')
        .then(({ runUpdateCheck }) => runUpdateCheck('startup'))
        .catch((err) => console.error('[git-light] update check failed:', err))
    }, 3000)
    void import('@/lib/tauri/appMenu')
      .then(({ setupAppMenu }) => setupAppMenu())
      .catch((err) => console.error('[git-light] app menu setup failed:', err))
  }
}

bootstrap().catch((err) => console.error('[git-light] bootstrap failed:', err))
