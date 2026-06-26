import { computed, watch, type ComputedRef, type Ref } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { storeToRefs } from 'pinia'
import {
  commitIndexForVirtual,
  PENDING_ROW_VIRTUAL_INDEX,
  virtualIndexForCommit,
  virtualRowCount,
} from '@/lib/graph/pendingGraphRow'
import { useRepositoryStore } from '@/stores/repository'
import { useSelectionStore } from '@/stores/selection'

export function useCommitGraphVirtualList(options: {
  scrollEl: Ref<HTMLElement | null>
  rowHeight: ComputedRef<number>
  hasPendingRow: ComputedRef<boolean>
}) {
  const repo = useRepositoryStore()
  const selection = useSelectionStore()
  const { selectedSha } = storeToRefs(selection)
  const { scrollEl, rowHeight, hasPendingRow } = options

  const virtualizer = useVirtualizer(
    computed(() => ({
      count: virtualRowCount(repo.commits.length, hasPendingRow.value),
      getScrollElement: () => scrollEl.value,
      estimateSize: () => rowHeight.value,
      overscan: 14,
    })),
  )

  const virtualItems = computed(() => virtualizer.value.getVirtualItems())
  const totalSize = computed(() => virtualizer.value.getTotalSize())

  function resolveCommitIndex(virtualIndex: number): number | null {
    return commitIndexForVirtual(virtualIndex, hasPendingRow.value)
  }

  watch(rowHeight, () => virtualizer.value.measure())

  watch(selectedSha, (sha) => {
    if (sha) {
      const index = repo.commits.findIndex((c) => c.sha === sha)
      if (index >= 0) {
        virtualizer.value.scrollToIndex(
          virtualIndexForCommit(index, hasPendingRow.value),
          { align: 'auto' },
        )
      }
      return
    }
    if (hasPendingRow.value) {
      virtualizer.value.scrollToIndex(PENDING_ROW_VIRTUAL_INDEX, { align: 'auto' })
    }
  })

  return { virtualizer, virtualItems, totalSize, resolveCommitIndex }
}
