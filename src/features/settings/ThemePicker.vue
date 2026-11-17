<script setup lang="ts">
import { computed } from 'vue'
import { Check, RotateCcw } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import {
  CUSTOM_THEME_COLOR_KEYS,
  CUSTOM_THEME_COLOR_LABEL_KEYS,
  type CustomThemeColorKey,
} from '@/lib/customTheme'
import { THEMES, type ThemePreference } from '@/lib/themes'
import { useUiStore } from '@/stores/ui'

const props = defineProps<{
  modelValue: ThemePreference
}>()

const ui = useUiStore()
const { customTheme } = storeToRefs(ui)

/** The custom card mirrors the user's current picks instead of static colors. */
const themes = computed(() =>
  THEMES.map((theme) =>
    theme.id === 'custom'
      ? {
          ...theme,
          swatches: [
            customTheme.value.app,
            customTheme.value.panel,
            customTheme.value.accent,
            customTheme.value.fg,
          ],
        }
      : theme,
  ),
)

function selectTheme(theme: ThemePreference): void {
  ui.setTheme(theme)
}

function updateColor(key: CustomThemeColorKey, event: Event): void {
  const value = (event.target as HTMLInputElement).value
  ui.setCustomThemeColor(key, value)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <button
        v-for="theme in themes"
        :key="theme.id"
        type="button"
        class="focus-ring flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors"
        :class="
          props.modelValue === theme.id
            ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
            : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)]'
        "
        :aria-pressed="props.modelValue === theme.id"
        @click="selectTheme(theme.id)"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <span class="text-[13px] font-medium text-[var(--color-fg)]">{{ $t(theme.labelKey) }}</span>
            <Check
              v-if="props.modelValue === theme.id"
              :size="14"
              class="shrink-0 text-[var(--color-accent)]"
            />
          </div>
          <p class="text-[12px] leading-snug text-[var(--color-fg-muted)]">
            {{ $t(theme.descriptionKey) }}
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

    <div
      v-if="props.modelValue === 'custom'"
      id="settings-custom-theme"
      class="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-3"
    >
      <div class="mb-3 flex items-center justify-between gap-3">
        <h4 class="text-[12px] font-semibold text-[var(--color-fg)]">
          {{ $t('settings.customTheme.title') }}
        </h4>
        <button
          type="button"
          class="focus-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
          @click="ui.resetCustomTheme()"
        >
          <RotateCcw :size="12" />
          {{ $t('settings.customTheme.reset') }}
        </button>
      </div>
      <p class="mb-3 text-[12px] leading-snug text-[var(--color-fg-muted)]">
        {{ $t('settings.customTheme.description') }}
      </p>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label
          v-for="key in CUSTOM_THEME_COLOR_KEYS"
          :key="key"
          class="flex items-center gap-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-panel-raised)] px-2.5 py-2"
        >
          <input
            type="color"
            class="size-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
            :value="customTheme[key]"
            :aria-label="$t(CUSTOM_THEME_COLOR_LABEL_KEYS[key])"
            @input="updateColor(key, $event)"
          />
          <span class="min-w-0 flex-1 truncate text-[12px] text-[var(--color-fg)]">
            {{ $t(CUSTOM_THEME_COLOR_LABEL_KEYS[key]) }}
          </span>
          <code class="shrink-0 font-mono text-[11px] text-[var(--color-fg-muted)]">
            {{ customTheme[key] }}
          </code>
        </label>
      </div>
    </div>
  </div>
</template>
