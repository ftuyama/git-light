import type { GitService } from './GitService'
import { tauriGitService } from '@/lib/tauri/tauriGitService'
import { isTauri } from '@/lib/backend'

/**
 * Renderer-side Git backend. Tauri IPC by default; swapped for the in-memory
 * mock by {@link useMockGitServiceIfRequested} in web-only dev.
 *
 * NOTE: kept as a synchronous `let` (live ESM binding) on purpose — the
 * previous top-level await blocked every importer and could leave `#app`
 * empty (black screen) when the module graph failed to evaluate in the
 * Tauri webview.
 */
export let gitService: GitService = tauriGitService

/**
 * Activates the mock backend when running plain `vite dev` in a browser with
 * `VITE_USE_MOCK=true`. No-op under Tauri or without the flag. Returns true
 * when the mock was activated.
 */
export async function useMockGitServiceIfRequested(): Promise<boolean> {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_MOCK !== 'true') return false
  if (isTauri()) return false
  const { MockGitService } = await import('./MockGitService')
  gitService = new MockGitService()
  return true
}
