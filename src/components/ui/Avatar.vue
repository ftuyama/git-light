<script setup lang="ts">
import { computed } from 'vue'
import type { Author } from '@/types/git'

const props = withDefaults(defineProps<{ author: Author; size?: number }>(), { size: 20 })

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  backgroundColor: `color-mix(in srgb, ${props.author.color} 30%, transparent)`,
  color: props.author.color,
  fontSize: `${Math.round(props.size * 0.42)}px`,
}))
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-inset ring-white/10"
    :style="style"
    :title="author.name"
  >
    {{ author.initials }}
  </span>
</template>
