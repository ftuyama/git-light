<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { storeToRefs } from 'pinia'
import FileRow from './FileRow.vue'
import FileTreeList from './FileTreeList.vue'
import { STATUS_ORDER } from './fileStatus'
import type { WorkingTreeFile } from '@/types/git'
import { useUiStore } from '@/stores/ui'

const props = defineProps<{ files: WorkingTreeFile[]; readonly?: boolean }>()

const ui = useUiStore()
const { fileListView } = storeToRefs(ui)

const ROW_HEIGHT = 28
const VIRTUAL_THRESHOLD = 100
const scrollEl = ref<HTMLElement | null>(null)

const sorted = computed(() =>
  [...props.files].sort((a, b) => {
    const byStatus = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    return byStatus !== 0 ? byStatus : a.path.localeCompare(b.path)
  }),
)

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
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <FileTreeList v-if="fileListView === 'tree'" :files="files" :readonly="readonly" />
    <div v-else ref="scrollEl" class="min-h-0 flex-1 overflow-y-auto px-1">
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
