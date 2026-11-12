import { ref, watch, type MaybeRefOrGetter, toValue } from 'vue'
import {
  avatarCacheVersion,
  markAvatarSourceMissing,
  resolveAuthorAvatarUrl,
} from '@/lib/avatarCache'

export function useAvatarImage(
  email: MaybeRefOrGetter<string>,
  avatarUrl: MaybeRefOrGetter<string>,
  size: MaybeRefOrGetter<number>,
) {
  const resolvedUrl = ref<string | null>(null)

  watch(
    [() => toValue(email), () => toValue(avatarUrl), () => toValue(size), avatarCacheVersion],
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
    const failedUrl = resolvedUrl.value
    resolvedUrl.value = null
    if (failedUrl) markAvatarSourceMissing(toValue(email), failedUrl)
  }

  return { resolvedUrl, onImageError }
}
