import { onScopeDispose, ref, watch, type Ref } from 'vue'

/**
 * Mirrors `source`, but only once it has been true for `delayMs`.
 *
 * Used by the repository loading skeleton: a cold tab switch takes 100-500ms
 * while a cached one paints instantly, so a skeleton that appeared immediately
 * would flash for the fast ones. Waiting also keeps the outgoing repository on
 * screen for the first moments of a slow switch instead of blanking the panes.
 *
 * Turns off instantly when `source` turns off, so the real view is never
 * delayed once the data has arrived.
 */
export function useDelayedFlag(source: Ref<boolean>, delayMs = 120): Ref<boolean> {
  const delayed = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  watch(
    source,
    (on) => {
      clearTimeout(timer)
      if (!on) {
        delayed.value = false
        return
      }
      timer = setTimeout(() => {
        delayed.value = true
      }, delayMs)
    },
    { immediate: true },
  )

  // The owning scope (a component setup) disposes the watcher on unmount; the
  // pending timer must not outlive it.
  onScopeDispose(() => clearTimeout(timer))

  return delayed
}
