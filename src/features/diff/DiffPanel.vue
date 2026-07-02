<script setup lang="ts">
import { computed } from 'vue'
import { Columns2, Loader2, Rows3, UserSearch } from '@lucide/vue'
import { useRepoDiffStore } from '@/stores/repoDiff'
import { useUiStore } from '@/stores/ui'
import Checkbox from '@/components/ui/Checkbox.vue'
import SplitDiffView from './SplitDiffView.vue'
import UnifiedDiffView from './UnifiedDiffView.vue'
import BlameView from './BlameView.vue'

const diffStore = useRepoDiffStore()
const ui = useUiStore()

const diff = computed(() => diffStore.diff)
const blame = computed(() => diffStore.blame)
const showDiffContent = computed(() => diffStore.panelMode === 'diff')
const showBlameContent = computed(() => diffStore.panelMode === 'blame')

function toggleIgnoreWhitespace(value: boolean): void {
  ui.setIgnoreWhitespace(value)
  if (diffStore.selectedFilePath && diffStore.panelMode === 'diff') {
    void diffStore.loadDiff(diffStore.selectedFilePath)
  }
}
</script>

<template>
  <section
    v-if="diffStore.selectedFilePath"
    class="flex h-full min-h-0 w-full flex-1 flex-col bg-[var(--color-app)]"
  >
    <header
      class="flex h-8 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-3 text-[11px] font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase"
    >
      <span class="flex-1 truncate normal-case">{{ diffStore.selectedFilePath }}</span>
      <span v-if="diff && showDiffContent" class="font-mono text-[10px] normal-case">
        +{{ diff.additions }} −{{ diff.deletions }}
      </span>
      <div class="flex items-center rounded border border-[var(--color-border)] p-0.5 normal-case">
        <button
          type="button"
          class="focus-ring rounded px-1.5 py-0.5 text-[10px] transition-colors"
          :class="showDiffContent
            ? 'bg-[var(--color-active)] text-[var(--color-fg)]'
            : 'text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]'"
          title="Diff view"
          @click="diffStore.setPanelMode('diff')"
        >
          <Rows3 :size="12" class="inline" />
        </button>
        <button
          type="button"
          class="focus-ring rounded px-1.5 py-0.5 text-[10px] transition-colors"
          :class="showBlameContent
            ? 'bg-[var(--color-active)] text-[var(--color-fg)]'
            : 'text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]'"
          title="Blame view"
          @click="diffStore.setPanelMode('blame')"
        >
          <UserSearch :size="12" class="inline" />
        </button>
      </div>
      <div
        v-if="diff && showDiffContent && !diff.binary && !diff.tooLarge"
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
      <label
        v-if="showDiffContent"
        class="flex items-center gap-1.5 text-[10px] font-normal normal-case text-[var(--color-fg-subtle)]"
      >
        <Checkbox
          :model-value="ui.ignoreWhitespace"
          aria-label="Ignore whitespace in diff"
          @update:model-value="toggleIgnoreWhitespace"
        />
        Ignore WS
      </label>
      <button
        type="button"
        class="focus-ring rounded px-1.5 py-0.5 text-[10px] normal-case text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]"
        @click="diffStore.selectFile(null)"
      >
        Close
      </button>
    </header>

    <div
      v-if="(showDiffContent && diffStore.diffLoading) || (showBlameContent && diffStore.blameLoading)"
      class="flex flex-1 items-center justify-center text-xs text-[var(--color-fg-subtle)]"
    >
      <Loader2 :size="16" class="mr-2 animate-spin" />
      {{ showBlameContent ? 'Loading blame…' : 'Loading diff…' }}
    </div>

    <template v-else-if="showDiffContent">
      <div
        v-if="diff?.tooLarge"
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
    </template>

    <template v-else-if="showBlameContent">
      <div
        v-if="blame && blame.lines.length === 0"
        class="flex flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
      >
        No blame information available for this file.
      </div>
      <BlameView v-else-if="blame" :blame="blame" />
    </template>
  </section>
</template>
