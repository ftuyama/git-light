<script setup lang="ts">
import { computed } from 'vue'
import { Columns2, Loader2, Pilcrow, Rows3, UserSearch, X } from '@lucide/vue'
import type { ImagePreviewRequest } from '@shared/git/models'
import { useRepoDiffStore } from '@/stores/repoDiff'
import { useUiStore } from '@/stores/ui'
import { isImagePath } from '@/lib/imageFiles'
import Tooltip from '@/components/ui/Tooltip.vue'
import SplitDiffView from './SplitDiffView.vue'
import UnifiedDiffView from './UnifiedDiffView.vue'
import ImageDiffView from './ImageDiffView.vue'
import WordWrapIcon from './WordWrapIcon.vue'

const diffStore = useRepoDiffStore()
const ui = useUiStore()

const diff = computed(() => diffStore.diff)

const isImageDiff = computed(() => Boolean(diff.value?.binary && isImagePath(diff.value.path)))

const imageRequest = computed<ImagePreviewRequest | null>(() => {
  const path = diffStore.selectedFilePath
  if (!path || !isImageDiff.value) return null
  const req = diffStore.diffRequestForPath(path) as ImagePreviewRequest & { ignoreWhitespace?: boolean }
  return { path: req.path, source: req.source, sha: req.sha, toSha: req.toSha }
})

function toggleIgnoreWhitespace(value: boolean): void {
  ui.setIgnoreWhitespace(value)
  if (diffStore.selectedFilePath) {
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
      <Tooltip label="Close file">
        <button
          type="button"
          class="focus-ring rounded p-1 text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
          aria-label="Close file"
          @click="diffStore.selectFile(null)"
        >
          <X :size="12" class="block" />
        </button>
      </Tooltip>
    </header>
    <div
      class="flex h-8 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-3"
    >
      <div class="flex items-center rounded border border-[var(--color-border)] p-0.5">
        <Tooltip label="Diff view">
          <button
            type="button"
            class="focus-ring flex items-center gap-1 rounded bg-[var(--color-active)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg)] transition-colors"
            aria-label="Diff view"
            :aria-pressed="true"
          >
            <Rows3 :size="12" class="shrink-0" />
            Diff
          </button>
        </Tooltip>
        <Tooltip label="Blame view">
          <button
            type="button"
            class="focus-ring flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]"
            aria-label="Blame view"
            :aria-pressed="false"
            @click="diffStore.setPanelMode('blame')"
          >
            <UserSearch :size="12" class="shrink-0" />
            Blame
          </button>
        </Tooltip>
      </div>
      <div
        v-if="diff && !diff.binary && !diff.tooLarge"
        class="flex items-center rounded border border-[var(--color-border)] p-0.5"
      >
        <Tooltip label="Unified diff">
          <button
            type="button"
            class="focus-ring rounded px-1.5 py-0.5 text-[10px] transition-colors"
            :class="ui.diffViewMode === 'unified'
              ? 'bg-[var(--color-active)] text-[var(--color-fg)]'
              : 'text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]'"
            aria-label="Unified diff"
            :aria-pressed="ui.diffViewMode === 'unified'"
            @click="ui.setDiffViewMode('unified')"
          >
            <Rows3 :size="12" class="inline" />
          </button>
        </Tooltip>
        <Tooltip label="Split diff">
          <button
            type="button"
            class="focus-ring rounded px-1.5 py-0.5 text-[10px] transition-colors"
            :class="ui.diffViewMode === 'split'
              ? 'bg-[var(--color-active)] text-[var(--color-fg)]'
              : 'text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]'"
            aria-label="Split diff"
            :aria-pressed="ui.diffViewMode === 'split'"
            @click="ui.setDiffViewMode('split')"
          >
            <Columns2 :size="12" class="inline" />
          </button>
        </Tooltip>
      </div>
      <div v-if="!isImageDiff" class="flex items-center rounded border border-[var(--color-border)] p-0.5">
        <Tooltip label="Ignore Leading/Trailing Space">
          <button
            type="button"
            class="focus-ring rounded px-1.5 py-0.5 text-[10px] transition-colors"
            :class="ui.ignoreWhitespace
              ? 'bg-[var(--color-active)] text-[var(--color-fg)]'
              : 'text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]'"
            aria-label="Ignore Leading/Trailing Space"
            :aria-pressed="ui.ignoreWhitespace"
            @click="toggleIgnoreWhitespace(!ui.ignoreWhitespace)"
          >
            <Pilcrow :size="12" class="inline" />
          </button>
        </Tooltip>
        <Tooltip label="Word Wrap">
          <button
            type="button"
            class="focus-ring rounded px-1.5 py-0.5 text-[10px] transition-colors"
            :class="ui.diffWordWrap
              ? 'bg-[var(--color-active)] text-[var(--color-fg)]'
              : 'text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]'"
            aria-label="Word Wrap"
            :aria-pressed="ui.diffWordWrap"
            @click="ui.setDiffWordWrap(!ui.diffWordWrap)"
          >
            <WordWrapIcon :size="12" />
          </button>
        </Tooltip>
      </div>
      <span class="flex-1" />
      <span v-if="diff && !isImageDiff" class="font-mono text-[10px] text-[var(--color-fg-muted)]">
        +{{ diff.additions }} −{{ diff.deletions }}
      </span>
    </div>

    <div
      v-if="diffStore.diffLoading"
      class="flex flex-1 items-center justify-center text-xs text-[var(--color-fg-subtle)]"
    >
      <Loader2 :size="16" class="mr-2 animate-spin" />
      Loading diff…
    </div>

    <template v-else>
      <div
        v-if="diff?.tooLarge"
        class="flex flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
      >
        File is too large to diff in the UI.
      </div>

      <div
        v-else-if="diff?.binary && isImageDiff && imageRequest"
        class="flex min-h-0 flex-1 flex-col"
      >
        <ImageDiffView :key="imageRequest.path + imageRequest.source + (imageRequest.sha ?? '') + (imageRequest.toSha ?? '')" :request="imageRequest" />
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
  </section>
</template>
