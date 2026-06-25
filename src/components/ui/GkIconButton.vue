<script setup lang="ts">
import { type Component, computed } from 'vue'
import { Loader2 } from '@lucide/vue'
import Tooltip from './Tooltip.vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    icon: Component
    label: string
    shortcut?: string
    disabled?: boolean
    active?: boolean
    busy?: boolean
    danger?: boolean
    tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
  }>(),
  { tooltipSide: 'bottom' },
)

const emit = defineEmits<{ click: [MouseEvent] }>()

const classes = computed(() =>
  cn(
    'app-no-drag focus-ring relative flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-fg-muted)] transition-all duration-150 active:scale-[0.94]',
    'hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]',
    props.active && 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
    props.danger && 'hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)]',
    props.disabled && 'pointer-events-none opacity-35',
  ),
)
</script>

<template>
  <Tooltip :label="label" :shortcut="shortcut" :side="tooltipSide">
    <button
      type="button"
      :class="classes"
      :disabled="disabled"
      :aria-label="label"
      :aria-pressed="active"
      @click="emit('click', $event)"
    >
      <component
        :is="busy ? Loader2 : icon"
        :size="16"
        :class="busy ? 'animate-spin' : ''"
        aria-hidden="true"
      />
    </button>
  </Tooltip>
</template>
