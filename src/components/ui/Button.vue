<script setup lang="ts">
import { type Component, computed } from 'vue'
import { Loader2 } from '@lucide/vue'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    icon?: Component
    disabled?: boolean
    busy?: boolean
    block?: boolean
  }>(),
  { variant: 'secondary', size: 'md' },
)

const emit = defineEmits<{ click: [MouseEvent] }>()

const classes = computed(() =>
  cn(
    'app-no-drag focus-ring inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.98]',
    props.size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
    props.block && 'w-full',
    props.variant === 'primary' &&
      'bg-[var(--color-accent-strong)] text-white shadow-sm hover:bg-[var(--color-accent)]',
    props.variant === 'secondary' &&
      'border border-[var(--color-border-strong)] bg-[var(--color-panel-raised)] text-[var(--color-fg)] hover:bg-[var(--color-hover)]',
    props.variant === 'ghost' &&
      'text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]',
    props.variant === 'danger' &&
      'bg-[var(--color-danger)] text-white shadow-sm hover:opacity-90',
    props.disabled && 'pointer-events-none opacity-40',
  ),
)
</script>

<template>
  <button type="button" :class="classes" :disabled="disabled" @click="emit('click', $event)">
    <component v-if="busy" :is="Loader2" :size="14" class="animate-spin" aria-hidden="true" />
    <component v-else-if="icon" :is="icon" :size="14" aria-hidden="true" />
    <slot />
  </button>
</template>
