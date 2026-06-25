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

  // Hydrate persisted UI sizes before mount to avoid a layout flash.
  const ui = useUiStore(pinia)
  await ui.hydrate()

  // Kick off the (mocked) repository load; components render skeletons until ready.
  void useRepositoryStore(pinia).load()

  app.mount('#app')
}

void bootstrap()
