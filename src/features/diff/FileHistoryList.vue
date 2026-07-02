<script setup lang="ts">
import { Loader2 } from '@lucide/vue'
import type { FileHistoryEntry } from '@shared/git/models'
import { relativeTime } from '@/lib/format'

defineProps<{
  entries: FileHistoryEntry[]
  loading: boolean
  selectedSha: string | null
  compact?: boolean
  embedded?: boolean
}>()

const emit = defineEmits<{
  select: [sha: string]
}>()
</script>

<template>
  <div
    class="overflow-y-auto"
    :class="embedded ? 'p-1' : compact ? 'min-h-0 flex-1 p-1' : 'min-h-0 flex-1 p-2'"
  >
    <div
      v-if="loading"
      class="flex items-center justify-center gap-2 py-12 text-[13px] text-[var(--color-fg-muted)]"
    >
      <Loader2 :size="16" class="animate-spin" />
      Loading history…
    </div>
    <p
      v-else-if="entries.length === 0"
      class="py-12 text-center text-[13px] text-[var(--color-fg-muted)]"
    >
      No commits found for this file.
    </p>
    <button
      v-for="entry in entries"
      :key="entry.sha"
      type="button"
      class="focus-ring flex w-full flex-col gap-0.5 rounded-md text-left transition-colors hover:bg-[var(--color-hover)]"
      :class="[
        compact ? 'px-2 py-1.5' : 'px-3 py-2',
        selectedSha === entry.sha && 'bg-[var(--color-accent-soft)]',
      ]"
      @click="emit('select', entry.sha)"
    >
      <div class="flex items-baseline gap-2">
        <span
          class="font-mono text-[var(--color-accent)]"
          :class="compact ? 'text-[10px]' : 'text-[11px]'"
        >{{ entry.shortSha }}</span>
        <span
          class="min-w-0 flex-1 truncate text-[var(--color-fg)]"
          :class="compact ? 'text-[12px]' : 'text-[13px]'"
        >
          {{ entry.subject }}
        </span>
      </div>
      <div class="text-[11px] text-[var(--color-fg-subtle)]">
        {{ entry.author }} · {{ relativeTime(new Date(entry.date)) }}
      </div>
    </button>
  </div>
</template>
