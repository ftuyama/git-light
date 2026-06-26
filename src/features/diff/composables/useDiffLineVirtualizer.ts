import { computed, ref, watch, type ComputedRef } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'

export const DIFF_ROW_HEIGHT = 20
const OVERSCAN = 24

export function useDiffLineVirtualizer(lineCount: ComputedRef<number>) {
  const scrollEl = ref<HTMLElement | null>(null)

  const virtualizer = useVirtualizer(
    computed(() => ({
      count: lineCount.value,
      getScrollElement: () => scrollEl.value,
      estimateSize: () => DIFF_ROW_HEIGHT,
      overscan: OVERSCAN,
    })),
  )

  const virtualItems = computed(() => virtualizer.value.getVirtualItems())
  const totalSize = computed(() => virtualizer.value.getTotalSize())

  watch(lineCount, () => virtualizer.value.measure())

  return { scrollEl, virtualItems, totalSize }
}
