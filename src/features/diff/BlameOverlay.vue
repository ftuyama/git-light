<script setup lang="ts">
import { computed } from 'vue'
import { Loader2, Rows3, UserSearch } from '@lucide/vue'
import { Splitpanes, Pane } from 'splitpanes'
import { useRepoDiffStore } from '@/stores/repoDiff'
import { useUiStore } from '@/stores/ui'
import Checkbox from '@/components/ui/Checkbox.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import BlameView from './BlameView.vue'
import BlameHistoryPanel from './BlameHistoryPanel.vue'

const diffStore = useRepoDiffStore()
const ui = useUiStore()

const blame = computed(() => diffStore.blame)
const loading = computed(() => diffStore.blameLoading)

const revisionLabel = computed(() => {
  const sha = diffStore.blameRevisionSha
  if (!sha) return null
  const entry = diffStore.fileHistoryEntries.find((item) => item.sha === sha)
  return entry?.shortSha ?? sha.slice(0, 7)
})
</script>

<template>
  <div
    class="absolute inset-0 z-40 flex flex-col bg-[var(--color-app)]"
    role="dialog"
    aria-modal="true"
    :aria-label="$t('diff.panel.blameView')"
  >
    <header
      class="flex h-8 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-3 text-[11px] font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase"
    >
      <span class="flex min-w-0 flex-1 items-center gap-2 truncate normal-case">
        <span class="truncate">{{ diffStore.selectedFilePath }}</span>
        <span
          v-if="revisionLabel"
          class="shrink-0 rounded bg-[var(--color-accent-soft)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-accent)]"
        >
          @ {{ revisionLabel }}
        </span>
      </span>
      <div class="flex items-center rounded border border-[var(--color-border)] p-0.5 normal-case">
        <Tooltip :label="$t('diff.panel.diffView')">
          <button
            type="button"
            class="focus-ring flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]"
            :aria-label="$t('diff.panel.diffView')"
            :aria-pressed="false"
            @click="diffStore.setPanelMode('diff')"
          >
            <Rows3 :size="12" class="shrink-0" />
            {{ $t('diff.panel.diff') }}
          </button>
        </Tooltip>
        <Tooltip :label="$t('diff.panel.blameView')">
          <button
            type="button"
            class="focus-ring flex items-center gap-1 rounded bg-[var(--color-active)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg)] transition-colors"
            :aria-label="$t('diff.panel.blameView')"
            :aria-pressed="true"
          >
            <UserSearch :size="12" class="shrink-0" />
            {{ $t('diff.panel.blame') }}
          </button>
        </Tooltip>
      </div>
      <label
        class="flex items-center gap-1.5 text-[10px] font-normal normal-case text-[var(--color-fg-subtle)]"
      >
        <Checkbox
          :model-value="ui.blameWordWrap"
          :aria-label="$t('diff.blame.wordWrapAria')"
          @update:model-value="ui.setBlameWordWrap"
        />
        {{ $t('diff.blame.wordWrap') }}
      </label>
      <Tooltip :label="$t('diff.panel.closeFile')">
        <button
          type="button"
          class="focus-ring rounded px-1.5 py-0.5 text-[10px] normal-case text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]"
          :aria-label="$t('diff.panel.closeFile')"
          @click="diffStore.selectFile(null)"
        >
          {{ $t('common.actions.close') }}
        </button>
      </Tooltip>
    </header>

    <div
      v-if="loading"
      class="flex flex-1 items-center justify-center text-xs text-[var(--color-fg-subtle)]"
    >
      <Loader2 :size="16" class="mr-2 animate-spin" />
      {{ $t('diff.blame.loading') }}
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
          {{ $t('diff.blame.empty') }}
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
