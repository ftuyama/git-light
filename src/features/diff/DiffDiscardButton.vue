<script setup lang="ts">
import { computed } from 'vue'
import { Trash2 } from '@lucide/vue'

const props = defineProps<{
  scope: 'hunk' | 'line'
}>()

const emit = defineEmits<{
  action: []
}>()

const titleKey = computed(() =>
  props.scope === 'hunk' ? 'diff.discard.discardHunk' : 'diff.discard.discardLine',
)

const labelKey = computed(() =>
  props.scope === 'hunk' ? 'diff.discard.discardHunk' : 'common.actions.discard',
)
</script>

<template>
  <button
    type="button"
    class="focus-ring diff-discard-btn shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-danger)] opacity-60 transition-opacity hover:bg-[var(--color-danger)]/10 group-hover/diff-row:opacity-100"
    :title="$t(titleKey)"
    @click.stop="emit('action')"
  >
    <Trash2 :size="11" class="inline" />
    {{ $t(labelKey) }}
  </button>
</template>
