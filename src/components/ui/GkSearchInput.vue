<script setup lang="ts">
import { ref } from 'vue'
import { Search, X } from '@lucide/vue'

withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    shortcut?: string
  }>(),
  { placeholder: 'Search' },
)

const emit = defineEmits<{ 'update:modelValue': [string] }>()
const input = ref<HTMLInputElement>()

defineExpose({
  focus: () => input.value?.focus(),
})
</script>

<template>
  <div
    class="group flex h-8 items-center gap-2 rounded-md border border-transparent bg-[var(--color-panel)] px-2.5 transition-colors focus-within:border-[var(--color-accent-strong)] focus-within:bg-[var(--color-app)]"
  >
    <Search :size="14" class="shrink-0 text-[var(--color-fg-subtle)]" />
    <input
      ref="input"
      :value="modelValue"
      :placeholder="placeholder"
      class="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none"
      spellcheck="false"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      v-if="modelValue"
      type="button"
      class="shrink-0 rounded p-0.5 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
      aria-label="Clear search"
      @click="emit('update:modelValue', '')"
    >
      <X :size="13" />
    </button>
    <kbd
      v-else-if="shortcut"
      class="shrink-0 rounded bg-white/5 px-1 py-px font-mono text-[10px] text-[var(--color-fg-subtle)]"
    >
      {{ shortcut }}
    </kbd>
  </div>
</template>
