<script setup lang="ts">
import { X } from '@lucide/vue'
import type { CompareRange } from '@/stores/selection'

defineProps<{
  range: CompareRange
  fileCount: number
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="shrink-0 border-b border-[var(--color-border)] px-3 py-2.5">
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <p class="text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase">
          Comparing commits
        </p>
        <p class="mt-1 font-mono text-[12px] text-[var(--color-fg)]">
          {{ range.fromShortSha }}
          <span class="text-[var(--color-fg-subtle)]">→</span>
          {{ range.toShortSha }}
        </p>
        <p class="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
          {{ fileCount }} {{ fileCount === 1 ? 'file changed' : 'files changed' }}
          <span class="text-[var(--color-fg-subtle)]">· Shift+click another commit to compare</span>
        </p>
      </div>
      <button
        class="focus-ring shrink-0 rounded p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
        title="Exit compare mode"
        aria-label="Exit compare mode"
        @click="emit('close')"
      >
        <X :size="14" />
      </button>
    </div>
  </div>
</template>
