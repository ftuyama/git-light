import { nextTick, watch, type Ref } from 'vue'

type BranchInputHandle = {
  focusWhenReady?: () => Promise<void>
}

/** Keeps branch name input focused after mount, menu dismiss, and virtual-list scroll. */
export function useBranchInputFocus(
  active: Ref<boolean>,
  inputRef: Ref<BranchInputHandle | null>,
): void {
  watch(
    active,
    (isActive) => {
      if (!isActive) return
      void nextTick(async () => {
        await inputRef.value?.focusWhenReady?.()
      })
    },
    { flush: 'post' },
  )
}
