<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
    mono?: boolean
  }>(),
  { tone: 'neutral' },
)

const classes = computed(() =>
  cn(
    'inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold leading-4',
    props.mono && 'font-mono',
    props.tone === 'neutral' && 'bg-white/8 text-[var(--color-fg-muted)]',
    props.tone === 'accent' && 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
    props.tone === 'success' && 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
    props.tone === 'warning' && 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
    props.tone === 'danger' && 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
    props.tone === 'info' && 'bg-[var(--color-info)]/15 text-[var(--color-info)]',
  ),
)
</script>

<template>
  <span :class="classes"><slot /></span>
</template>
