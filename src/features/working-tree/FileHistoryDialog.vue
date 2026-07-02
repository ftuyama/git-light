<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { X } from '@lucide/vue'
import { useRepoDiffStore } from '@/stores/repoDiff'
import { useSelectionStore } from '@/stores/selection'
import FileHistoryList from '@/features/diff/FileHistoryList.vue'

const diffStore = useRepoDiffStore()
const selection = useSelectionStore()

const open = computed(() => diffStore.fileHistoryOpen)
const path = computed(() => diffStore.fileHistoryPath)
const entries = computed(() => diffStore.fileHistoryEntries)
const loading = computed(() => diffStore.fileHistoryLoading)

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) diffStore.closeFileHistory()
}

function selectEntry(sha: string): void {
  void diffStore.selectFileHistoryEntry(sha)
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[195] flex items-center justify-center bg-black/55 p-6 backdrop-blur-[2px]"
      @click.self="diffStore.closeFileHistory()"
    >
      <div
        class="flex h-[min(480px,80vh)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-panel)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="File history"
      >
        <header
          class="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4 py-3"
        >
          <div class="min-w-0">
            <h2 class="text-sm font-semibold text-[var(--color-fg)]">File History</h2>
            <p class="truncate text-[12px] text-[var(--color-fg-muted)]">{{ path }}</p>
          </div>
          <button
            class="focus-ring shrink-0 rounded p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
            aria-label="Close"
            @click="diffStore.closeFileHistory()"
          >
            <X :size="16" />
          </button>
        </header>

        <FileHistoryList
          :entries="entries"
          :loading="loading"
          :selected-sha="selection.selectedSha"
          @select="selectEntry"
        />
      </div>
    </div>
  </Teleport>
</template>
