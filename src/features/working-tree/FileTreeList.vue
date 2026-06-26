<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRight, Folder } from '@lucide/vue'
import FileRow from './FileRow.vue'
import { buildFileTree, flattenFileTree } from './buildFileTree'
import type { FileTreeFolder } from './buildFileTree'
import type { WorkingTreeFile } from '@/types/git'
import { cn } from '@/lib/utils'

const props = defineProps<{ files: WorkingTreeFile[]; readonly?: boolean }>()

const collapsed = ref(new Set<string>())

const tree = computed(() => buildFileTree(props.files))
const rows = computed(() => flattenFileTree(tree.value, collapsed.value))

function toggleFolder(folder: FileTreeFolder): void {
  const next = new Set(collapsed.value)
  if (next.has(folder.path)) next.delete(folder.path)
  else next.add(folder.path)
  collapsed.value = next
}

function isExpanded(folder: FileTreeFolder): boolean {
  return !collapsed.value.has(folder.path)
}
</script>

<template>
  <div class="min-h-0 flex-1 overflow-y-auto px-1">
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
