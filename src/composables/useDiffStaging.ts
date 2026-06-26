import { computed, type Ref } from 'vue'
import type { DiffHunk, DiffResult } from '@shared/git/models'
import { buildPatchFromHunk, buildPatchFromHunkLines } from '@shared/diff/buildPatch'
import { useRepositoryStore } from '@/stores/repository'
import { useRepoDiffStore } from '@/stores/repoDiff'
import { useSelectionStore } from '@/stores/selection'

export function useDiffStaging(diff: Ref<DiffResult>) {
  const repo = useRepositoryStore()
  const diffStore = useRepoDiffStore()
  const selection = useSelectionStore()

  const viewingStaged = computed(() => {
    if (diffStore.selectedFileStaged != null) return diffStore.selectedFileStaged
    const path = diffStore.selectedFilePath
    if (!path) return false
    return repo.workingTree.find((f) => f.path === path)?.staged ?? false
  })

  const canStage = computed(
    () =>
      !selection.selectedSha &&
      !selection.isCompareMode &&
      !viewingStaged.value &&
      Boolean(diffStore.selectedFilePath),
  )
  const canUnstage = computed(
    () =>
      !selection.selectedSha &&
      !selection.isCompareMode &&
      viewingStaged.value &&
      Boolean(diffStore.selectedFilePath),
  )
  const canPartialStage = computed(() => canStage.value || canUnstage.value)

  function hunkAt(index: number): DiffHunk | undefined {
    return diff.value.hunks[index]
  }

  async function stageHunk(hunkIndex: number): Promise<void> {
    const path = diffStore.selectedFilePath
    const hunk = hunkAt(hunkIndex)
    if (!path || !hunk) return
    const file = repo.workingTree.find(
      (f) => f.path === path && f.staged === viewingStaged.value,
    )
    await repo.runAction(
      {
        kind: 'stage-patch',
        target: path,
        meta: {
          patch: buildPatchFromHunk(path, hunk, diff.value.oldPath),
          intentToAdd: file?.status === 'untracked',
        },
      },
      { skipConfirm: true },
    )
  }

  async function unstageHunk(hunkIndex: number): Promise<void> {
    const path = diffStore.selectedFilePath
    const hunk = hunkAt(hunkIndex)
    if (!path || !hunk) return
    await repo.runAction(
      {
        kind: 'unstage-patch',
        target: path,
        meta: { patch: buildPatchFromHunk(path, hunk, diff.value.oldPath) },
      },
      { skipConfirm: true },
    )
  }

  async function stageLines(hunkIndex: number, lineIndices: number[]): Promise<void> {
    const path = diffStore.selectedFilePath
    const hunk = hunkAt(hunkIndex)
    if (!path || !hunk || lineIndices.length === 0) return
    const file = repo.workingTree.find(
      (f) => f.path === path && f.staged === viewingStaged.value,
    )
    await repo.runAction(
      {
        kind: 'stage-patch',
        target: path,
        meta: {
          patch: buildPatchFromHunkLines(path, hunk, lineIndices, diff.value.oldPath),
          intentToAdd: file?.status === 'untracked',
        },
      },
      { skipConfirm: true },
    )
  }

  async function unstageLines(hunkIndex: number, lineIndices: number[]): Promise<void> {
    const path = diffStore.selectedFilePath
    const hunk = hunkAt(hunkIndex)
    if (!path || !hunk || lineIndices.length === 0) return
    await repo.runAction(
      {
        kind: 'unstage-patch',
        target: path,
        meta: { patch: buildPatchFromHunkLines(path, hunk, lineIndices, diff.value.oldPath) },
      },
      { skipConfirm: true },
    )
  }

  return {
    canStage,
    canUnstage,
    canPartialStage,
    stageHunk,
    unstageHunk,
    stageLines,
    unstageLines,
  }
}
