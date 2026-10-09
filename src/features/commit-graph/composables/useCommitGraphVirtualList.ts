import { computed, watch, type ComputedRef, type Ref } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { storeToRefs } from 'pinia'
import {
  buildGraphRows,
  commitVirtualIndexByCommit,
  stashVirtualIndexByStash,
  type GraphRow,
} from '@/lib/graph/stashGraphRows'
import { useRepositoryStore } from '@/stores/repository'
import { useSelectionStore } from '@/stores/selection'

export function useCommitGraphVirtualList(options: {
  scrollEl: Ref<HTMLElement | null>
  rowHeight: ComputedRef<number>
  hasPendingRow: ComputedRef<boolean>
}) {
  const repo = useRepositoryStore()
  const selection = useSelectionStore()
  const { selectedSha, selectedStash } = storeToRefs(selection)
  const { scrollEl, rowHeight, hasPendingRow } = options

  /** Ordered rows: pending row, then commits with stashes above their base. */
  const rows = computed<GraphRow[]>(() =>
    buildGraphRows(repo.commits, hasPendingRow.value, repo.stashes),
  )

  const commitVirtualByCommit = computed(() => commitVirtualIndexByCommit(rows.value))

  const pendingVirtualIndex = computed(() =>
    rows.value.findIndex((row) => row.kind === 'pending'),
  )

  const virtualizer = useVirtualizer(
    computed(() => ({
      count: rows.value.length,
      getScrollElement: () => scrollEl.value,
      estimateSize: () => rowHeight.value,
      overscan: 14,
    })),
  )

  const virtualItems = computed(() => virtualizer.value.getVirtualItems())
  const totalSize = computed(() => virtualizer.value.getTotalSize())

  function rowAt(virtualIndex: number): GraphRow | undefined {
    return rows.value[virtualIndex]
  }

  function resolveCommitIndex(virtualIndex: number): number | null {
    const row = rowAt(virtualIndex)
    return row?.kind === 'commit' ? row.commitIndex : null
  }

  function resolveStashIndex(virtualIndex: number): number | null {
    const row = rowAt(virtualIndex)
    return row?.kind === 'stash' ? row.stashIndex : null
  }

  function isPendingIndex(virtualIndex: number): boolean {
    return rowAt(virtualIndex)?.kind === 'pending'
  }

  function virtualIndexForCommitIndex(commitIndex: number): number {
    return commitVirtualByCommit.value.get(commitIndex) ?? -1
  }

  function virtualIndexForStashId(stashId: string): number {
    const stashIndex = repo.stashes.findIndex((s) => s.id === stashId)
    if (stashIndex < 0) return -1
    return stashVirtualIndexByStash(rows.value).get(stashIndex) ?? -1
  }

  watch(rowHeight, () => virtualizer.value.measure())

  watch(selectedSha, (sha) => {
    if (sha) {
      const index = repo.commits.findIndex((c) => c.sha === sha)
      if (index >= 0) {
        virtualizer.value.scrollToIndex(virtualIndexForCommitIndex(index), {
          align: 'auto',
        })
      }
      return
    }
    // A stash selection also clears selectedSha — don't jump to pending then.
    if (selectedStash.value) return
    if (pendingVirtualIndex.value >= 0) {
      virtualizer.value.scrollToIndex(pendingVirtualIndex.value, { align: 'auto' })
    }
  })

  watch(selectedStash, (stashId) => {
    if (!stashId) return
    const virtualIndex = virtualIndexForStashId(stashId)
    if (virtualIndex >= 0) {
      virtualizer.value.scrollToIndex(virtualIndex, { align: 'auto' })
    }
  })

  return {
    virtualizer,
    virtualItems,
    totalSize,
    rows,
    resolveCommitIndex,
    resolveStashIndex,
    isPendingIndex,
    virtualIndexForCommitIndex,
  }
}
