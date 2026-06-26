<script setup lang="ts">
import { FolderTree, List } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import { cn } from '@/lib/utils'
import type { FileListView } from '@/lib/preferences'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const { fileListView } = storeToRefs(ui)

function setView(view: FileListView): void {
  ui.setFileListView(view)
}
</script>

<template>
  <div
    class="flex shrink-0 items-center rounded-md border border-[var(--color-border)] p-0.5"
    role="group"
    aria-label="File list view"
  >
    <button
      class="focus-ring rounded px-1 py-0.5 text-[var(--color-fg-subtle)] transition-colors"
      :class="cn(fileListView === 'path' && 'bg-[var(--color-hover)] text-[var(--color-fg)]')"
      title="Path view"
      aria-label="Path view"
      :aria-pressed="fileListView === 'path'"
      @click="setView('path')"
    >
      <List :size="13" />
    </button>
    <button
      class="focus-ring rounded px-1 py-0.5 text-[var(--color-fg-subtle)] transition-colors"
      :class="cn(fileListView === 'tree' && 'bg-[var(--color-hover)] text-[var(--color-fg)]')"
      title="Tree view"
      aria-label="Tree view"
      :aria-pressed="fileListView === 'tree'"
      @click="setView('tree')"
    >
      <FolderTree :size="13" />
    </button>
  </div>
</template>
