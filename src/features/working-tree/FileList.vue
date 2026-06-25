<script setup lang="ts">
import { computed, ref } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import FileRow from './FileRow.vue'
import { STATUS_ORDER } from './fileStatus'
import type { WorkingTreeFile } from '@/types/git'

const props = defineProps<{ files: WorkingTreeFile[] }>()

const ROW_HEIGHT = 28
const scrollEl = ref<HTMLElement | null>(null)

const sorted = computed(() =>
  [...props.files].sort((a, b) => {
    const byStatus = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    return byStatus !== 0 ? byStatus : a.path.localeCompare(b.path)
  }),
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
</script>

<template>
  <div ref="scrollEl" class="min-h-0 flex-1 overflow-y-auto px-1">
    <div class="relative w-full" :style="{ height: `${totalSize}px` }">
      <div
        v-for="item in virtualItems"
        :key="item.index"
        class="absolute right-0 left-0"
        :style="{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }"
      >
        <FileRow :file="sorted[item.index]" />
      </div>
    </div>
  </div>
</template>
