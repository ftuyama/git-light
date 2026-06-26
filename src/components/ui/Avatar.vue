<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Author } from '@/types/git'

const props = withDefaults(
  defineProps<{
    author: Author
    size?: number
    ringColor?: string
    merge?: boolean
  }>(),
  { size: 20, merge: false },
)

const imageFailed = ref(false)

watch(
  () => props.author.avatarUrl,
  () => {
    imageFailed.value = false
  },
)

const showImage = computed(
  () => !props.merge && Boolean(props.author.avatarUrl) && !imageFailed.value,
)

const mergePointSize = computed(() => Math.max(6, Math.round(props.size * 0.5)))

const mergeStyle = computed(() => ({
  width: `${mergePointSize.value}px`,
  height: `${mergePointSize.value}px`,
  backgroundColor: props.ringColor ?? props.author.color,
}))

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  backgroundColor: showImage.value
    ? 'transparent'
    : props.ringColor
      ? `color-mix(in srgb, ${props.author.color} 30%, var(--color-app))`
      : `color-mix(in srgb, ${props.author.color} 30%, transparent)`,
  color: props.author.color,
  fontSize: `${Math.round(props.size * 0.42)}px`,
  boxShadow: props.ringColor ? `0 0 0 2px ${props.ringColor}` : undefined,
}))
</script>

<template>
  <span
    v-if="merge"
    class="inline-block shrink-0 rounded-full"
    :style="mergeStyle"
    :title="author.name"
  />
  <span
    v-else
    class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ring-1 ring-inset ring-white/10"
    :style="style"
    :title="author.name"
  >
    <img
      v-if="showImage"
      :src="author.avatarUrl"
      :alt="author.name"
      class="h-full w-full object-cover"
      loading="lazy"
      @error="imageFailed = true"
    />
    <template v-else>{{ author.initials }}</template>
  </span>
</template>
