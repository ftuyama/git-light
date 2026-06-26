<script setup lang="ts">
import { Check } from '@lucide/vue'
import { THEMES, type ThemePreference } from '@/lib/themes'
import { useUiStore } from '@/stores/ui'

defineProps<{
  modelValue: ThemePreference
}>()

const ui = useUiStore()

function selectTheme(theme: ThemePreference): void {
  ui.setTheme(theme)
}
</script>

<template>
  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
    <button
      v-for="theme in THEMES"
      :key="theme.id"
      type="button"
      class="focus-ring flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors"
      :class="
        modelValue === theme.id
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)]'
      "
      :aria-pressed="modelValue === theme.id"
      @click="selectTheme(theme.id)"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <div class="flex items-center gap-2">
          <span class="text-[13px] font-medium text-[var(--color-fg)]">{{ theme.label }}</span>
          <Check
            v-if="modelValue === theme.id"
            :size="14"
            class="shrink-0 text-[var(--color-accent)]"
          />
        </div>
        <p class="text-[12px] leading-snug text-[var(--color-fg-muted)]">
          {{ theme.description }}
        </p>
        <div class="mt-0.5 flex items-center gap-1.5">
          <span
            v-for="(swatch, index) in theme.swatches"
            :key="index"
            class="size-3.5 rounded-full border border-[var(--color-border-strong)]"
            :style="{ backgroundColor: swatch }"
            :aria-hidden="true"
          />
        </div>
      </div>
    </button>
  </div>
</template>
