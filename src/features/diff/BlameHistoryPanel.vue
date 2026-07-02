<script setup lang="ts">
import { computed } from 'vue'
import { useRepoDiffStore } from '@/stores/repoDiff'
import FileHistoryList from './FileHistoryList.vue'

const diffStore = useRepoDiffStore()

const entries = computed(() => diffStore.fileHistoryEntries)
const loading = computed(() => diffStore.fileHistoryLoading)
const selectedSha = computed(() => diffStore.blameRevisionSha)

function selectEntry(sha: string): void {
  void diffStore.selectBlameHistoryEntry(sha)
}
</script>

<template>
  <aside class="flex h-full min-h-0 w-full flex-col border-r border-[var(--color-border)] bg-[var(--color-panel)]">
    <header class="shrink-0 border-b border-[var(--color-border)] px-3 py-2">
      <h3 class="text-[11px] font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase">
        File History
      </h3>
      <p class="truncate text-[11px] text-[var(--color-fg-subtle)]">
        {{ diffStore.selectedFilePath }}
      </p>
    </header>
    <FileHistoryList
      :entries="entries"
      :loading="loading"
      :selected-sha="selectedSha"
      compact
      @select="selectEntry"
    />
  </aside>
</template>
