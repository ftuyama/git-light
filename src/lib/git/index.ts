import type { GitService } from './GitService'
import { ipcGitService } from './IpcGitService'

async function createDevGitService(): Promise<GitService> {
  if (
    import.meta.env.VITE_USE_MOCK === 'true' ||
    typeof window.electron?.git?.openRepo !== 'function'
  ) {
    const { MockGitService } = await import('./MockGitService')
    return new MockGitService()
  }
  return ipcGitService
}

export const gitService: GitService = import.meta.env.DEV
  ? await createDevGitService()
  : ipcGitService
