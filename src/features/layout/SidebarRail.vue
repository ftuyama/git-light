<script setup lang="ts">
import { GitBranch, FileDiff, PanelLeftOpen, PanelRightOpen } from '@lucide/vue'
import GkIconButton from '@/components/ui/GkIconButton.vue'

const props = defineProps<{ side: 'left' | 'right' }>()
defineEmits<{ expand: [] }>()
</script>

<template>
  <div
    class="flex w-12 shrink-0 flex-col items-center gap-1 border-[var(--color-border)] bg-[var(--color-panel)] py-2"
    :class="side === 'left' ? 'border-r' : 'border-l'"
  >
    <GkIconButton
      :icon="side === 'left' ? PanelLeftOpen : PanelRightOpen"
      :label="`Expand ${side} panel`"
      :tooltip-side="side === 'left' ? 'right' : 'left'"
      @click="$emit('expand')"
    />
    <div class="my-1 h-px w-6 bg-[var(--color-border)]" />
    <GkIconButton
      :icon="side === 'left' ? GitBranch : FileDiff"
      :label="side === 'left' ? 'Branches' : 'Changes'"
      :tooltip-side="side === 'left' ? 'right' : 'left'"
      @click="$emit('expand')"
    />
  </div>
</template>
