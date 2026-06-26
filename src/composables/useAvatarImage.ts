import { ref, watch, type MaybeRefOrGetter, toValue } from 'vue'
import { markAvatarMissing, resolveAuthorAvatarUrl } from '@/lib/avatarCache'

export function useAvatarImage(
  email: MaybeRefOrGetter<string>,
  avatarUrl: MaybeRefOrGetter<string>,
  size: MaybeRefOrGetter<number>,
) {
  const resolvedUrl = ref<string | null>(null)

  watch(
    [() => toValue(email), () => toValue(avatarUrl), () => toValue(size)],
    () => {
      resolvedUrl.value = resolveAuthorAvatarUrl(
        toValue(email),
        toValue(avatarUrl),
        toValue(size),
      )
    },
    { immediate: true },
  )

  function onImageError(): void {
    markAvatarMissing(toValue(email))
    resolvedUrl.value = null
  }

  return { resolvedUrl, onImageError }
}
