<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { Loader2, X } from '@lucide/vue'
import { relativeTime } from '@/lib/format'
import { useRepoDiffStore } from '@/stores/repoDiff'
import { useSelectionStore } from '@/stores/selection'

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

        <div class="min-h-0 flex-1 overflow-y-auto p-2">
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
            class="focus-ring flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--color-hover)]"
            :class="selection.selectedSha === entry.sha && 'bg-[var(--color-accent-soft)]'"
            @click="selectEntry(entry.sha)"
          >
            <div class="flex items-baseline gap-2">
              <span class="font-mono text-[11px] text-[var(--color-accent)]">{{ entry.shortSha }}</span>
              <span class="min-w-0 flex-1 truncate text-[13px] text-[var(--color-fg)]">
                {{ entry.subject }}
              </span>
            </div>
            <div class="text-[11px] text-[var(--color-fg-subtle)]">
              {{ entry.author }} · {{ relativeTime(new Date(entry.date)) }}
            </div>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
