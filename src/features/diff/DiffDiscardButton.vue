<script setup lang="ts">
import { Trash2 } from '@lucide/vue'

defineProps<{
  scope: 'hunk' | 'line'
}>()

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <button
    type="button"
    class="focus-ring diff-discard-btn shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-danger)] opacity-60 transition-opacity hover:bg-[var(--color-danger)]/10 group-hover/diff-row:opacity-100"
    :title="scope === 'hunk' ? 'Discard hunk' : 'Discard line'"
    @click.stop="emit('action')"
  >
    <Trash2 :size="11" class="inline" />
    Discard{{ scope === 'hunk' ? ' hunk' : '' }}
  </button>
</template>
