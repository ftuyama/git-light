import type { SnapshotOptions, SnapshotScope } from '@shared/git/models'
import { useUiStore } from '@/stores/ui'
import type { SnapshotRefreshOptions } from '@/lib/git/GitService'

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let pendingRefreshScopes: SnapshotScope[] | undefined
let pendingFullRefresh = false
let suppressWatcherUntil = 0

/** Skip watcher-driven status-only refreshes briefly after an in-app git action. */
export function suppressWatcherRefresh(ms = 500): void {
  suppressWatcherUntil = Date.now() + ms
}

function isWatcherRefreshSuppressed(scopes?: SnapshotScope[]): boolean {
  if (Date.now() >= suppressWatcherUntil) return false
  return scopes?.length === 1 && scopes[0] === 'status'
}

export function graphSnapshotOptions(
  extra?: Pick<SnapshotOptions, 'invalidateCommits'>,
): SnapshotRefreshOptions {
  const ui = useUiStore()
  return {
    graphScope: ui.graphScope,
    commitLimit: ui.clampedCommitGraphLimit,
    ...extra,
  }
}

export function scheduleSnapshotRefresh(
  refresh: (scopes?: SnapshotScope[]) => Promise<void>,
  scopes?: SnapshotScope[],
): void {
  if (isWatcherRefreshSuppressed(scopes)) return
  if (refreshTimer) clearTimeout(refreshTimer)
  if (scopes === undefined) {
    pendingFullRefresh = true
  } else if (!pendingFullRefresh) {
    pendingRefreshScopes = [...new Set([...(pendingRefreshScopes ?? []), ...scopes])]
  }
  refreshTimer = setTimeout(() => {
    const merged = pendingFullRefresh ? undefined : pendingRefreshScopes
    pendingRefreshScopes = undefined
    pendingFullRefresh = false
    void refresh(merged)
  }, 150)
}

export function resetRefreshScheduler(): void {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = null
  pendingRefreshScopes = undefined
  pendingFullRefresh = false
  suppressWatcherUntil = 0
}
