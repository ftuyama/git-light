<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { AlertTriangle, ListTree, Loader2, X } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import GkButton from '@/components/ui/GkButton.vue'
import GkSearchInput from '@/components/ui/GkSearchInput.vue'
import RebaseCommitRow from './RebaseCommitRow.vue'
import { useInteractiveRebaseStore } from '@/stores/interactiveRebase'

const rebase = useInteractiveRebaseStore()
const { isOpen, base, baseShortSha, entries, loading, starting } = storeToRefs(rebase)

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && !starting.value) rebase.close()
}

watch(isOpen, (dialogOpen) => {
  if (dialogOpen) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
})

onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[190] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      @click.self="!starting && rebase.close()"
    >
      <div
        class="flex max-h-[min(88vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-panel)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Interactive rebase"
      >
        <header class="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div class="flex items-center gap-2">
            <ListTree :size="18" class="text-[var(--color-accent)]" />
            <h2 class="text-sm font-semibold text-[var(--color-fg)]">Interactive Rebase</h2>
          </div>
          <button
            type="button"
            class="focus-ring rounded p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)] disabled:opacity-50"
            aria-label="Close"
            :disabled="starting"
            @click="rebase.close()"
          >
            <X :size="16" />
          </button>
        </header>

        <div class="space-y-4 overflow-y-auto px-4 py-4">
          <div class="space-y-2">
            <label class="text-xs font-medium text-[var(--color-fg-muted)]">Rebase onto</label>
            <div class="flex gap-2" @keydown.enter.prevent="rebase.loadCommits()">
              <GkSearchInput
                :model-value="base"
                class="flex-1"
                placeholder="HEAD~5, main, or commit SHA"
                @update:model-value="rebase.setBase($event)"
              />
              <GkButton variant="secondary" :busy="loading" @click="rebase.loadCommits()">Load</GkButton>
            </div>
            <p v-if="baseShortSha" class="text-[11px] text-[var(--color-fg-subtle)]">
              {{ entries.length }} commit{{ entries.length === 1 ? '' : 's' }} after
              <code class="font-mono">{{ baseShortSha }}</code>
            </p>
          </div>

          <div
            class="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90"
          >
            <AlertTriangle :size="14" class="mt-0.5 shrink-0 text-amber-400" />
            <p>
              This rewrites commit history. Reorder commits by dragging, choose an action for each
              row, then start the rebase.
            </p>
          </div>

          <div v-if="loading" class="flex items-center justify-center gap-2 py-10 text-sm text-[var(--color-fg-muted)]">
            <Loader2 :size="16" class="animate-spin" />
            Loading commits…
          </div>

          <div v-else-if="entries.length > 0" class="space-y-2">
            <RebaseCommitRow
              v-for="(entry, index) in entries"
              :key="entry.sha"
              :entry="entry"
              :index="index"
            />
          </div>

          <p v-else class="py-8 text-center text-sm text-[var(--color-fg-muted)]">
            Enter a base ref and load commits to build your rebase plan.
          </p>
        </div>

        <footer class="flex justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
          <GkButton variant="ghost" :disabled="starting" @click="rebase.close()">Cancel</GkButton>
          <GkButton
            variant="primary"
            :disabled="entries.length === 0 || loading"
            :busy="starting"
            @click="rebase.start()"
          >
            Start Rebase
          </GkButton>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
