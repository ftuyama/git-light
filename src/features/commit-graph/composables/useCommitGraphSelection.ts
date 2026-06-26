import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRepositoryStore } from '@/stores/repository'
import { useSelectionStore } from '@/stores/selection'

export function useCommitGraphSelection() {
  const repo = useRepositoryStore()
  const selection = useSelectionStore()
  const { selectedSha, hoveredSha, compareRange } = storeToRefs(selection)

  function selectRow(sha: string, event?: MouseEvent): void {
    if (event?.shiftKey && selectedSha.value && selectedSha.value !== sha) {
      selection.selectWithShift(sha)
      return
    }
    selection.select(selectedSha.value === sha ? null : sha)
  }

  function selectPendingRow(): void {
    selection.select(null)
  }

  function rowClasses(commitIndex: number): string {
    const sha = repo.commits[commitIndex]?.sha
    const isSelected = selectedSha.value === sha
    const isHovered = hoveredSha.value === sha
    const range = compareRange.value
    const inCompare = range && (sha === range.fromSha || sha === range.toSha)

    if (isSelected) return 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
    if (inCompare) return 'border-[var(--color-info)] bg-[var(--color-info)]/10'
    if (isHovered) return 'border-transparent bg-[var(--color-hover)]/80'
    return 'border-transparent hover:bg-[var(--color-hover)]/60'
  }

  return { selectedSha, selectRow, selectPendingRow, rowClasses, selection }
}

export function useCommitGraphState() {
  const repo = useRepositoryStore()
  const selection = useSelectionStore()
  const { selectedSha } = storeToRefs(selection)

  const showLoading = computed(() => repo.loading || repo.branchSwitching)
  const hasPendingRow = computed(() => repo.hasPendingChanges && repo.headCommitIndex >= 0)
  const headIndex = computed(() => repo.headCommitIndex)
  const pendingRowSelected = computed(() => hasPendingRow.value && !selectedSha.value)

  return { repo, showLoading, hasPendingRow, headIndex, pendingRowSelected }
}
