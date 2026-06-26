<script setup lang="ts">
import { computed } from 'vue'
import { Columns2, Loader2, Rows3 } from '@lucide/vue'
import { useRepositoryStore } from '@/stores/repository'
import { useUiStore } from '@/stores/ui'
import SplitDiffView from './SplitDiffView.vue'
import UnifiedDiffView from './UnifiedDiffView.vue'

const repo = useRepositoryStore()
const ui = useUiStore()

const diff = computed(() => repo.diff)
</script>

<template>
  <section
    v-if="repo.selectedFilePath"
    class="flex h-full min-h-0 w-full flex-1 flex-col bg-[var(--color-app)]"
  >
    <header
      class="flex h-8 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-3 text-[11px] font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase"
    >
      <span class="flex-1 truncate normal-case">{{ repo.selectedFilePath }}</span>
      <span v-if="diff" class="font-mono text-[10px] normal-case">
        +{{ diff.additions }} −{{ diff.deletions }}
      </span>
      <div
        v-if="diff && !diff.binary && !diff.tooLarge"
        class="flex items-center rounded border border-[var(--color-border)] p-0.5 normal-case"
      >
        <button
          type="button"
          class="focus-ring rounded px-1.5 py-0.5 text-[10px] transition-colors"
          :class="ui.diffViewMode === 'unified'
            ? 'bg-[var(--color-active)] text-[var(--color-fg)]'
            : 'text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]'"
          title="Unified diff"
          @click="ui.setDiffViewMode('unified')"
        >
          <Rows3 :size="12" class="inline" />
        </button>
        <button
          type="button"
          class="focus-ring rounded px-1.5 py-0.5 text-[10px] transition-colors"
          :class="ui.diffViewMode === 'split'
            ? 'bg-[var(--color-active)] text-[var(--color-fg)]'
            : 'text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]'"
          title="Split diff"
          @click="ui.setDiffViewMode('split')"
        >
          <Columns2 :size="12" class="inline" />
        </button>
      </div>
      <button
        type="button"
        class="focus-ring rounded px-1.5 py-0.5 text-[10px] normal-case text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]"
        @click="repo.selectFile(null)"
      >
        Close
      </button>
    </header>

    <div v-if="repo.diffLoading" class="flex flex-1 items-center justify-center text-xs text-[var(--color-fg-subtle)]">
      <Loader2 :size="16" class="mr-2 animate-spin" /> Loading diff…
    </div>

    <div
      v-else-if="diff?.tooLarge"
      class="flex flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
    >
      File is too large to diff in the UI.
    </div>

    <div
      v-else-if="diff?.binary"
      class="flex flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
    >
      Binary file — no text diff available.
    </div>

    <UnifiedDiffView v-else-if="diff && ui.diffViewMode === 'unified'" :diff="diff" />
    <SplitDiffView v-else-if="diff" :diff="diff" />
  </section>
</template>
