import type { GitService } from './GitService'
import { ipcGitService } from './IpcGitService'
import { MockGitService } from './MockGitService'

const useMock =
  (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true') ||
  typeof window.electron?.git?.openRepo !== 'function'

export const gitService: GitService = useMock ? new MockGitService() : ipcGitService
