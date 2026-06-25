<script setup lang="ts">
import { computed } from 'vue'
import { GitBranch, Tag as TagIcon, Cloud } from '@lucide/vue'
import type { Ref } from '@/types/git'

const props = defineProps<{ refData: Ref }>()

const icon = computed(() => {
  if (props.refData.type === 'tag') return TagIcon
  if (props.refData.type === 'remoteBranch') return Cloud
  return GitBranch
})

const classes = computed(() => {
  switch (props.refData.type) {
    case 'head':
      return 'bg-[var(--color-accent-strong)] text-white'
    case 'tag':
      return 'bg-[var(--color-warning)]/18 text-[var(--color-warning)]'
    case 'remoteBranch':
      return 'bg-white/6 text-[var(--color-fg-subtle)]'
    default:
      return 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
  }
})
</script>

<template>
  <span
    class="inline-flex h-[18px] max-w-[160px] items-center gap-1 rounded px-1.5 text-[11px] font-medium"
    :class="classes"
  >
    <component :is="icon" :size="11" class="shrink-0" />
    <span class="truncate">{{ refData.label }}</span>
  </span>
</template>
