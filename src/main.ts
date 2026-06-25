import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useUiStore } from './stores/ui'
import { useRepositoryStore } from './stores/repository'
import 'splitpanes/dist/splitpanes.css'
import './assets/theme.css'

async function bootstrap(): Promise<void> {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  const ui = useUiStore(pinia)
  await ui.hydrate()

  const repo = useRepositoryStore(pinia)
  await repo.init()

  const useMock =
    import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true' && typeof repo.loadMock === 'function'
  if (useMock) {
    void repo.loadMock()
  } else {
    const lastPath = ui.lastRepositoryPath
    if (lastPath) {
      const opened = await repo.openRepository(lastPath, { silent: true })
      if (!opened) ui.setLastRepositoryPath(null)
    }
  }

  app.mount('#app')
}

void bootstrap()
