<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{
  label: string
  description?: string
  modelValue: string
  options: readonly { value: string; label: string }[]
}>()

defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <div
    class="flex items-start justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--color-hover)]"
  >
    <div class="min-w-0 pt-0.5">
      <div class="text-[13px] font-medium text-[var(--color-fg)]">{{ label }}</div>
      <p v-if="description" class="mt-0.5 text-[12px] leading-snug text-[var(--color-fg-muted)]">
        {{ description }}
      </p>
    </div>
    <div
      class="flex shrink-0 items-center gap-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-app)] p-0.5"
      role="group"
      :aria-label="label"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="focus-ring rounded px-2 py-1 text-[11px] font-medium transition-colors"
        :class="
          cn(
            modelValue === option.value
              ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
              : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]',
          )
        "
        :aria-pressed="modelValue === option.value"
        @click="$emit('update:modelValue', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
