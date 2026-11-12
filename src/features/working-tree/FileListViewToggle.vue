<script setup lang="ts">
import { FolderTree, List } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import { cn } from '@/lib/utils'
import type { FileListView } from '@/lib/preferences'
import { useUiStore } from '@/stores/ui'

withDefaults(defineProps<{ withLabels?: boolean }>(), { withLabels: false })
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
    :aria-label="$t('workingTree.view.aria')"
  >
    <button
      class="focus-ring flex items-center gap-1 rounded px-1 py-0.5 text-[var(--color-fg-subtle)] transition-colors"
      :class="
        cn(
          fileListView === 'path' && 'bg-[var(--color-hover)] text-[var(--color-fg)]',
          withLabels && 'px-2',
        )
      "
      :title="$t('workingTree.view.path')"
      :aria-label="$t('workingTree.view.path')"
      :aria-pressed="fileListView === 'path'"
      @click="setView('path')"
    >
      <List :size="13" />
      <span v-if="withLabels" class="text-[11px] font-medium">{{ $t('workingTree.view.path') }}</span>
    </button>
    <button
      class="focus-ring flex items-center gap-1 rounded px-1 py-0.5 text-[var(--color-fg-subtle)] transition-colors"
      :class="
        cn(
          fileListView === 'tree' && 'bg-[var(--color-hover)] text-[var(--color-fg)]',
          withLabels && 'px-2',
        )
      "
      :title="$t('workingTree.view.tree')"
      :aria-label="$t('workingTree.view.tree')"
      :aria-pressed="fileListView === 'tree'"
      @click="setView('tree')"
    >
      <FolderTree :size="13" />
      <span v-if="withLabels" class="text-[11px] font-medium">{{ $t('workingTree.view.tree') }}</span>
    </button>
  </div>
</template>
