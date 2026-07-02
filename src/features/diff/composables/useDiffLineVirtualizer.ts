import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'

export const DIFF_ROW_HEIGHT = 20
const OVERSCAN = 24

export function useDiffLineVirtualizer(
  lineCount: ComputedRef<number>,
  options?: {
    getRowHeight?: Ref<((index: number) => number) | undefined>
  },
) {
  const scrollEl = ref<HTMLElement | null>(null)

  const virtualizer = useVirtualizer(
    computed(() => ({
      count: lineCount.value,
      getScrollElement: () => scrollEl.value,
      estimateSize: (index: number) =>
        options?.getRowHeight?.value?.(index) ?? DIFF_ROW_HEIGHT,
      overscan: OVERSCAN,
    })),
  )

  const virtualItems = computed(() => virtualizer.value.getVirtualItems())
  const totalSize = computed(() => virtualizer.value.getTotalSize())

  watch(lineCount, () => virtualizer.value.measure())

  if (options?.getRowHeight) {
    watch(options.getRowHeight, () => virtualizer.value.measure(), { deep: true })
  }

  return { scrollEl, virtualItems, totalSize, virtualizer }
}
