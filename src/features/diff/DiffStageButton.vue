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

/** Title names the exact target, while the visible label stays short. */
const titleKey = computed(() => {
  if (props.mode === 'stage') {
    return props.scope === 'hunk' ? 'diff.stage.stageHunk' : 'diff.stage.stageLine'
  }
  return props.scope === 'hunk' ? 'diff.stage.unstageHunk' : 'diff.stage.unstageLine'
})

const labelKey = computed(() => {
  if (props.mode === 'stage') {
    return props.scope === 'hunk' ? 'diff.stage.stageHunk' : 'diff.stage.stage'
  }
  return props.scope === 'hunk' ? 'diff.stage.unstageHunk' : 'diff.stage.unstage'
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
    :title="$t(titleKey)"
    @click.stop="emit('action')"
  >
    <component :is="mode === 'stage' ? Plus : Minus" :size="11" class="inline" />
    {{ $t(labelKey) }}
  </button>
</template>
