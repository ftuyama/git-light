<script setup lang="ts">
import { Check, Sparkles, Zap } from '@lucide/vue'
import type { UiMode } from '@/lib/preferences'
import { useUiStore } from '@/stores/ui'

defineProps<{
  modelValue: UiMode
  compact?: boolean
}>()

const ui = useUiStore()

const options: {
  id: UiMode
  label: string
  description: string
  icon: typeof Zap
}[] = [
  {
    id: 'basic',
    label: 'Basic',
    description:
      'Essential Git actions only. Hides stash, rebase, cherry-pick, tags, terminal, and more.',
    icon: Zap,
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Full toolbar, sidebar sections, and commit actions.',
    icon: Sparkles,
  },
]

function selectMode(mode: UiMode): void {
  ui.setUiMode(mode)
}
</script>

<template>
  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" :class="compact && 'gap-1.5'">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      class="focus-ring flex items-start gap-3 rounded-lg border text-left transition-colors"
      :class="[
        compact ? 'px-3 py-2.5' : 'px-3 py-3',
        modelValue === option.id
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)]',
      ]"
      :aria-pressed="modelValue === option.id"
      @click="selectMode(option.id)"
    >
      <component
        :is="option.icon"
        :size="16"
        class="mt-0.5 shrink-0"
        :class="
          modelValue === option.id
            ? 'text-[var(--color-accent)]'
            : 'text-[var(--color-fg-subtle)]'
        "
      />
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex items-center gap-2">
          <span class="text-[13px] font-medium text-[var(--color-fg)]">{{ option.label }}</span>
          <Check
            v-if="modelValue === option.id"
            :size="14"
            class="shrink-0 text-[var(--color-accent)]"
          />
        </div>
        <p class="text-[12px] leading-snug text-[var(--color-fg-muted)]">
          {{ option.description }}
        </p>
      </div>
    </button>
  </div>
</template>
