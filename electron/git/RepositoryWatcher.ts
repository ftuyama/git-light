import { join, relative } from 'node:path'
import type { BrowserWindow } from 'electron'
import type { RepoChangeEvent, SnapshotScope } from '@shared/git/models'

type ChokidarModule = typeof import('chokidar')
type FSWatcher = import('chokidar').FSWatcher

const GIT_IGNORED = [
  '**/objects/**',
  '**/logs/**',
  '**/hooks/**',
  '**/fsmonitor**',
  '**/info/**',
]

const WORKTREE_IGNORED = [
  '**/.git/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/target/**',
  '**/vendor/**',
  '**/__pycache__/**',
  '**/.venv/**',
  '**/.turbo/**',
  '**/.cache/**',
  '**/coverage/**',
]

const AWAIT_WRITE_FINISH = { stabilityThreshold: 150, pollInterval: 50 }

/**
 * Watches the working tree and `.git` metadata for changes made outside the
 * app (terminal git commands, other editors). Debounces events and pushes a
 * scoped refresh hint to the renderer.
 *
 * Uses native watchers only for `.git` metadata (few files). The working tree
 * is polled so large repositories do not hit per-file `EMFILE` limits on macOS.
 */
export class RepositoryWatcher {
  private watchers: FSWatcher[] = []
  private repoPath: string | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private onChange: ((event: RepoChangeEvent) => void) | null = null

  async watch(repoPath: string, onChange: (event: RepoChangeEvent) => void): Promise<void> {
    await this.stop()
    this.repoPath = repoPath
    this.onChange = onChange

    const chokidar = (await import('chokidar')) as ChokidarModule

    const schedule = (scopes: SnapshotScope[]): void => {
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => {
        if (this.repoPath) this.onChange?.({ path: this.repoPath, scopes })
      }, 150)
    }

    const onFileChange = (_event: string, filePath: string): void => {
      schedule(scopesForPath(repoPath, filePath))
    }

    const gitWatcher = chokidar.watch(join(repoPath, '.git'), {
      ignoreInitial: true,
      awaitWriteFinish: AWAIT_WRITE_FINISH,
      ignored: GIT_IGNORED,
    })

    const workTreeWatcher = chokidar.watch(repoPath, {
      ignoreInitial: true,
      awaitWriteFinish: AWAIT_WRITE_FINISH,
      ignored: WORKTREE_IGNORED,
      usePolling: true,
      interval: 2000,
      binaryInterval: 3000,
    })

    for (const watcher of [gitWatcher, workTreeWatcher]) {
      watcher.on('all', onFileChange)
      watcher.on('error', (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        console.warn('[RepositoryWatcher]', message)
      })
    }

    this.watchers = [gitWatcher, workTreeWatcher]
  }

  async stop(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null

    await Promise.all(
      this.watchers.map(async (watcher) => {
        try {
          await watcher.close()
        } catch {
          /* watcher may already be closed */
        }
      }),
    )
    this.watchers = []
    this.repoPath = null
    this.onChange = null
  }
}

export function scopesForPath(repoPath: string, filePath: string): SnapshotScope[] {
  const rel = relative(repoPath, filePath)
  if (rel.includes('.git/HEAD') || rel.includes('.git/index') || rel.includes('.git/refs')) {
    return ['commits', 'branches', 'status']
  }
  if (
    rel.includes('MERGE') ||
    rel.includes('REBASE') ||
    rel.includes('CHERRY_PICK') ||
    rel.includes('REVERT')
  ) {
    return ['status', 'branches', 'commits']
  }
  if (rel.includes('.git/')) {
    return ['status']
  }
  return ['status']
}

export function attachFocusRefresh(win: BrowserWindow, refresh: () => void): void {
  win.webContents.on('did-finish-load', () => {
    /* noop */
  })
  win.on('focus', refresh)
}
