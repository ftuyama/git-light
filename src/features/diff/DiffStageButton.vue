<script setup lang="ts">
import { Minus, Plus } from '@lucide/vue'

defineProps<{
  mode: 'stage' | 'unstage'
  scope: 'hunk' | 'line'
}>()

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <button
    type="button"
    class="focus-ring diff-stage-btn shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium opacity-0 transition-opacity group-hover/diff-row:opacity-100"
    :class="mode === 'stage'
      ? 'text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]'
      : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)]'"
    :title="mode === 'stage'
      ? (scope === 'hunk' ? 'Stage hunk' : 'Stage line')
      : (scope === 'hunk' ? 'Unstage hunk' : 'Unstage line')"
    @click.stop="emit('action')"
  >
    <component :is="mode === 'stage' ? Plus : Minus" :size="11" class="inline" />
    {{ mode === 'stage' ? 'Stage' : 'Unstage' }}{{ scope === 'hunk' ? ' hunk' : '' }}
  </button>
</template>
