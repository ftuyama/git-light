<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { storeToRefs } from 'pinia'
import FileRow from './FileRow.vue'
import FileTreeList from './FileTreeList.vue'
import { sortFilesForDisplay } from './fileStatus'
import { fileNavTargetIndex, isPlainFileNavEvent, selectedFileIndex } from './fileNavigation'
import type { WorkingTreeFile } from '@/types/git'
import { useUiStore } from '@/stores/ui'
import { useRepoDiffStore } from '@/stores/repoDiff'

const props = defineProps<{ files: WorkingTreeFile[]; readonly?: boolean }>()

const ui = useUiStore()
const diffStore = useRepoDiffStore()
const { fileListView } = storeToRefs(ui)

const ROW_HEIGHT = 28
const VIRTUAL_THRESHOLD = 100
const scrollEl = ref<HTMLElement | null>(null)

const sorted = computed(() => sortFilesForDisplay(props.files))

const useVirtual = computed(
  () => fileListView.value === 'path' && sorted.value.length > VIRTUAL_THRESHOLD,
)

const virtualizer = useVirtualizer(
  computed(() => ({
    count: sorted.value.length,
    getScrollElement: () => scrollEl.value,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })),
)

const virtualItems = computed(() => virtualizer.value.getVirtualItems())
const totalSize = computed(() => virtualizer.value.getTotalSize())

async function remeasure(): Promise<void> {
  if (!useVirtual.value) return
  await nextTick()
  virtualizer.value.measure()
}

watch(() => props.files, remeasure, { deep: true })
onMounted(() => {
  void remeasure()
})

/** Keep the selected row visible when the diff is steered from outside the list (graph arrows). */
async function revealSelected(): Promise<void> {
  await nextTick()
  const find = (): HTMLElement | null =>
    scrollEl.value?.querySelector<HTMLElement>('[data-file-selected="true"]') ?? null
  let row = find()
  if (!row && useVirtual.value) {
    const index = selectedFileIndex(
      sorted.value,
      diffStore.selectedFilePath,
      diffStore.selectedFileStaged,
    )
    if (index < 0) return
    virtualizer.value.scrollToIndex(index)
    await nextTick()
    row = find()
  }
  row?.scrollIntoView({ block: 'nearest' })
}

watch(
  [() => diffStore.selectedFilePath, () => diffStore.selectedFileStaged],
  () => void revealSelected(),
)

async function focusRow(id: string, index: number): Promise<void> {
  type Row = HTMLElement | null
  const find = (): Row =>
    scrollEl.value?.querySelector<HTMLElement>(`[data-file-row-id="${id}"]`) ?? null
  let row = find()
  if (!row && useVirtual.value) {
    virtualizer.value.scrollToIndex(index)
    await nextTick()
    row = find()
  }
  row?.focus()
}

/** ArrowUp/ArrowDown (and Home/End) walk the visible files while the list has focus. */
function onListKeydown(event: KeyboardEvent): void {
  if (!isPlainFileNavEvent(event)) return
  const files = sorted.value
  const current = selectedFileIndex(files, diffStore.selectedFilePath, diffStore.selectedFileStaged)
  const target = fileNavTargetIndex(current, files.length, event.key)
  if (target == null) return
  // Stop here so the global graph shortcut does not also move the commit selection.
  event.preventDefault()
  event.stopPropagation()
  if (target === current) return
  const file = files[target]
  diffStore.selectFile(file.path, { staged: file.staged })
  void focusRow(file.id, target)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <FileTreeList v-if="fileListView === 'tree'" :files="files" :readonly="readonly" />
    <div
      v-else
      ref="scrollEl"
      class="min-h-0 flex-1 overflow-y-auto px-1 outline-none"
      tabindex="0"
      @keydown="onListKeydown"
    >
    <template v-if="useVirtual">
      <div class="relative w-full" :style="{ height: `${totalSize}px` }">
        <div
          v-for="item in virtualItems"
          :key="sorted[item.index]?.id ?? item.index"
          class="absolute right-0 left-0"
          :style="{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }"
        >
          <FileRow :file="sorted[item.index]" :readonly="readonly" view="path" />
        </div>
      </div>
    </template>
    <template v-else>
      <FileRow
        v-for="file in sorted"
        :key="file.id"
        :file="file"
        :readonly="readonly"
        view="path"
      />
    </template>
  </div>
  </div>
</template>
