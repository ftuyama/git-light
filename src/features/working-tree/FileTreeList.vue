<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ChevronRight, Folder } from '@lucide/vue'
import FileRow from './FileRow.vue'
import { buildFileTree, flattenFileTree } from './buildFileTree'
import type { FileTreeFolder, FileTreeNode } from './buildFileTree'
import { fileNavTargetIndex, isPlainFileNavEvent, selectedFileIndex } from './fileNavigation'
import type { WorkingTreeFile } from '@/types/git'
import { cn } from '@/lib/utils'
import { useRepoDiffStore } from '@/stores/repoDiff'

const props = defineProps<{ files: WorkingTreeFile[]; readonly?: boolean }>()

const diffStore = useRepoDiffStore()
const collapsed = ref(new Set<string>())
const rootEl = ref<HTMLElement | null>(null)

const tree = computed(() => buildFileTree(props.files))
const rows = computed(() => flattenFileTree(tree.value, collapsed.value))

/** Files in the order they are painted, skipping folder rows. */
const visibleFiles = computed(() =>
  rows.value.flatMap((row) => (row.file ? [row.file] : [])),
)

// Drop collapse state for folders that no longer exist when the file set changes
// (e.g. switching working-tree → commit → compare).
watch(tree, (next) => {
  if (collapsed.value.size === 0) return
  const existing = new Set<string>()
  const collect = (nodes: FileTreeNode[]): void => {
    for (const n of nodes) {
      if (n.kind !== 'folder') continue
      existing.add(n.path)
      collect(n.children)
    }
  }
  collect(next)
  let changed = false
  const pruned = new Set<string>()
  for (const p of collapsed.value) {
    if (existing.has(p)) pruned.add(p)
    else changed = true
  }
  if (changed) collapsed.value = pruned
})

function toggleFolder(folder: FileTreeFolder): void {
  const next = new Set(collapsed.value)
  if (next.has(folder.path)) next.delete(folder.path)
  else next.add(folder.path)
  collapsed.value = next
}

function isExpanded(folder: FileTreeFolder): boolean {
  return !collapsed.value.has(folder.path)
}

async function focusRow(id: string): Promise<void> {
  await nextTick()
  rootEl.value?.querySelector<HTMLElement>(`[data-file-row-id="${id}"]`)?.focus()
}

/** Keep the selected row visible when the diff is steered from outside the list (graph arrows). */
watch(
  [() => diffStore.selectedFilePath, () => diffStore.selectedFileStaged],
  async () => {
    await nextTick()
    rootEl.value
      ?.querySelector<HTMLElement>('[data-file-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  },
)

/** ArrowUp/ArrowDown (and Home/End) walk the expanded files while the tree has focus. */
function onListKeydown(event: KeyboardEvent): void {
  if (!isPlainFileNavEvent(event)) return
  const files = visibleFiles.value
  const current = selectedFileIndex(files, diffStore.selectedFilePath, diffStore.selectedFileStaged)
  const target = fileNavTargetIndex(current, files.length, event.key)
  if (target == null) return
  // Stop here so the global graph shortcut does not also move the commit selection.
  event.preventDefault()
  event.stopPropagation()
  if (target === current) return
  const file = files[target]
  diffStore.selectFile(file.path, { staged: file.staged })
  void focusRow(file.id)
}
</script>

<template>
  <div
    ref="rootEl"
    class="min-h-0 flex-1 overflow-y-auto px-1 outline-none"
    tabindex="0"
    @keydown="onListKeydown"
  >
    <template v-for="(row, index) in rows" :key="`${row.kind}-${row.folder?.path ?? row.file?.id ?? index}`">
      <button
        v-if="row.kind === 'folder' && row.folder"
        class="focus-ring flex h-7 w-full cursor-pointer items-center gap-1 rounded-md px-2 text-left transition-colors hover:bg-[var(--color-hover)]"
        :style="{ paddingLeft: `${8 + row.depth * 14}px` }"
        @click="toggleFolder(row.folder)"
      >
        <ChevronRight
          :size="12"
          class="shrink-0 text-[var(--color-fg-subtle)] transition-transform"
          :class="cn(isExpanded(row.folder) && 'rotate-90')"
        />
        <Folder :size="13" class="shrink-0 text-[var(--color-fg-muted)]" />
        <span class="truncate text-[12px] text-[var(--color-fg-muted)]">{{ row.folder.name }}</span>
      </button>
      <div v-else-if="row.file" :style="{ paddingLeft: `${8 + row.depth * 14}px` }">
        <FileRow :file="row.file" :readonly="readonly" view="tree" />
      </div>
    </template>
  </div>
</template>
