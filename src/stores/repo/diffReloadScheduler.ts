import type { WorkingTreeFile } from '@/types/git'
import { useRepoDiffStore } from '@/stores/repoDiff'

let diffReloadTimer: ReturnType<typeof setTimeout> | null = null
let lastSelectedFileKey = ''

function fileKey(files: WorkingTreeFile[], path: string, viewingStaged: boolean | null): string {
  const staged = viewingStaged ?? false
  const file = files.find((f) => f.path === path && f.staged === staged)
  if (!file) return `${path}:missing:${staged}`
  return `${path}:${file.status}:${staged}:${file.additions}:${file.deletions}`
}

/** Debounced diff reload; skips when a status-only refresh leaves the file unchanged. */
export function scheduleDiffReload(
  workingTree: WorkingTreeFile[],
  scopes?: import('@shared/git/models').SnapshotScope[],
): void {
  const diffStore = useRepoDiffStore()
  const path = diffStore.selectedFilePath
  if (!path) return

  const statusOnly = scopes?.length === 1 && scopes[0] === 'status'
  const key = fileKey(workingTree, path, diffStore.selectedFileStaged)
  if (statusOnly && key === lastSelectedFileKey) return
  lastSelectedFileKey = key

  if (diffReloadTimer) clearTimeout(diffReloadTimer)
  diffReloadTimer = setTimeout(() => {
    diffReloadTimer = null
    if (!diffStore.selectedFilePath) return
    if (diffStore.selectedFileIsConflicted) void diffStore.loadConflict(diffStore.selectedFilePath)
    else void diffStore.reloadCurrentFile()
  }, 200)
}

export function resetDiffReloadScheduler(): void {
  if (diffReloadTimer) clearTimeout(diffReloadTimer)
  diffReloadTimer = null
  lastSelectedFileKey = ''
}
