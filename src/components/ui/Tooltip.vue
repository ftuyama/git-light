<script setup lang="ts">
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'

withDefaults(
  defineProps<{
    label: string
    shortcut?: string
    side?: 'top' | 'right' | 'bottom' | 'left'
  }>(),
  { side: 'bottom' },
)
</script>

<template>
  <TooltipRoot :delay-duration="320">
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        :side="side"
        :side-offset="6"
        class="animate-pop z-50 flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-2 py-1 text-xs font-medium text-[var(--color-fg)] shadow-lg shadow-black/40 select-none"
      >
        {{ label }}
        <kbd
          v-if="shortcut"
          class="rounded bg-white/10 px-1 py-px font-mono text-[10px] text-[var(--color-fg-muted)]"
        >
          {{ shortcut }}
        </kbd>
        <TooltipArrow class="fill-[var(--color-elevated)]" />
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
