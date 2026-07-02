<script setup lang="ts">
import { computed } from 'vue'
import { Loader2, Rows3, UserSearch } from '@lucide/vue'
import { Splitpanes, Pane } from 'splitpanes'
import { useRepoDiffStore } from '@/stores/repoDiff'
import Tooltip from '@/components/ui/Tooltip.vue'
import BlameView from './BlameView.vue'
import BlameHistoryPanel from './BlameHistoryPanel.vue'

const diffStore = useRepoDiffStore()

const blame = computed(() => diffStore.blame)
const loading = computed(() => diffStore.blameLoading)
</script>

<template>
  <div
    class="absolute inset-0 z-40 flex flex-col bg-[var(--color-app)]"
    role="dialog"
    aria-modal="true"
    aria-label="Blame view"
  >
    <header
      class="flex h-8 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-3 text-[11px] font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase"
    >
      <span class="flex-1 truncate normal-case">{{ diffStore.selectedFilePath }}</span>
      <div class="flex items-center rounded border border-[var(--color-border)] p-0.5 normal-case">
        <Tooltip label="Diff view">
          <button
            type="button"
            class="focus-ring flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]"
            aria-label="Diff view"
            :aria-pressed="false"
            @click="diffStore.setPanelMode('diff')"
          >
            <Rows3 :size="12" class="shrink-0" />
            Diff
          </button>
        </Tooltip>
        <Tooltip label="Blame view">
          <button
            type="button"
            class="focus-ring flex items-center gap-1 rounded bg-[var(--color-active)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg)] transition-colors"
            aria-label="Blame view"
            :aria-pressed="true"
          >
            <UserSearch :size="12" class="shrink-0" />
            Blame
          </button>
        </Tooltip>
      </div>
      <Tooltip label="Close file">
        <button
          type="button"
          class="focus-ring rounded px-1.5 py-0.5 text-[10px] normal-case text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]"
          aria-label="Close file"
          @click="diffStore.selectFile(null)"
        >
          Close
        </button>
      </Tooltip>
    </header>

    <div
      v-if="loading"
      class="flex flex-1 items-center justify-center text-xs text-[var(--color-fg-subtle)]"
    >
      <Loader2 :size="16" class="mr-2 animate-spin" />
      Loading blame…
    </div>

    <Splitpanes v-else class="blame-overlay-split min-h-0 flex-1">
      <Pane :size="28" :min-size="18" :max-size="40">
        <BlameHistoryPanel />
      </Pane>
      <Pane :size="72" class="flex min-h-0 flex-col">
        <div
          v-if="blame && blame.lines.length === 0"
          class="flex h-full items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
        >
          No blame information available for this file.
        </div>
        <BlameView v-else-if="blame" class="h-full min-h-0" :blame="blame" />
      </Pane>
    </Splitpanes>
  </div>
</template>

<style scoped>
.blame-overlay-split :deep(.splitpanes__splitter) {
  background: var(--color-border);
  width: 4px;
}
</style>
