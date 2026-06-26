import type { WorkingTreeFile } from '@/types/git'
import { useRepoDiffStore } from '@/stores/repoDiff'

let diffReloadTimer: ReturnType<typeof setTimeout> | null = null
let lastSelectedFileKey = ''

function fileKey(files: WorkingTreeFile[], path: string): string {
  const file = files.find((f) => f.path === path)
  if (!file) return `${path}:missing`
  return `${path}:${file.status}:${file.staged}`
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
  const key = fileKey(workingTree, path)
  if (statusOnly && key === lastSelectedFileKey) return
  lastSelectedFileKey = key

  if (diffReloadTimer) clearTimeout(diffReloadTimer)
  diffReloadTimer = setTimeout(() => {
    diffReloadTimer = null
    if (!diffStore.selectedFilePath) return
    if (diffStore.selectedFileIsConflicted) void diffStore.loadConflict(diffStore.selectedFilePath)
    else void diffStore.loadDiff(diffStore.selectedFilePath)
  }, 200)
}

export function resetDiffReloadScheduler(): void {
  if (diffReloadTimer) clearTimeout(diffReloadTimer)
  diffReloadTimer = null
  lastSelectedFileKey = ''
}
