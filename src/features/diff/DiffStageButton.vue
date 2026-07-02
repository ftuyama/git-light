<script setup lang="ts">
import { computed } from 'vue'
import { Minus, Plus } from '@lucide/vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    mode: 'stage' | 'unstage'
    scope: 'hunk' | 'line'
    visible?: boolean
  }>(),
  { visible: false },
)

const emit = defineEmits<{
  action: []
}>()

const opacityClass = computed(() => {
  if (props.visible) return 'opacity-100'
  if (props.scope === 'hunk') return 'opacity-60 group-hover/diff-row:opacity-100'
  return 'opacity-0 group-hover/diff-row:opacity-100'
})
</script>

<template>
  <button
    type="button"
    class="focus-ring diff-stage-btn shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium transition-opacity"
    :class="cn(
      opacityClass,
      mode === 'stage'
        ? 'text-[var(--color-success)] hover:bg-[var(--color-success)]/10'
        : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)]',
    )"
    :title="mode === 'stage'
      ? (scope === 'hunk' ? 'Stage hunk' : 'Stage line')
      : (scope === 'hunk' ? 'Unstage hunk' : 'Unstage line')"
    @click.stop="emit('action')"
  >
    <component :is="mode === 'stage' ? Plus : Minus" :size="11" class="inline" />
    {{ mode === 'stage' ? 'Stage' : 'Unstage' }}{{ scope === 'hunk' ? ' hunk' : '' }}
  </button>
</template>
