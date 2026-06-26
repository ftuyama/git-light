<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRepositoryStore } from '@/stores/repository'
import { useUiStore } from '@/stores/ui'

defineProps<{
  graphWidth: number
  nodeX: number
  nodeSize: number
  rowHeight: number
  selected: boolean
}>()

const repo = useRepositoryStore()
const ui = useUiStore()
const { columnWidths } = storeToRefs(ui)

const changedCount = computed(() => repo.workingTree.length)
const stagedCount = computed(() => repo.stagedFiles.length)
const unstagedCount = computed(() => repo.unstagedFiles.length)

const summary = computed(() => {
  const parts: string[] = []
  if (unstagedCount.value) parts.push(`${unstagedCount.value} changed`)
  if (stagedCount.value) parts.push(`${stagedCount.value} staged`)
  return parts.length ? parts.join(' · ') : `${changedCount.value} files`
})
</script>

<template>
  <div
    class="relative flex h-full items-center pr-3 pl-3 text-[13px]"
    :class="selected ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg)]/90'"
  >
    <div
      class="relative z-20 flex min-w-0 items-center gap-1 px-2"
      :style="{ width: `${columnWidths.refs}px` }"
    />

    <div
      class="relative z-0 flex shrink-0 items-center"
      :style="{ width: `${graphWidth}px`, height: `${rowHeight}px` }"
      aria-hidden="true"
    />

    <div
      class="relative flex shrink-0 items-center gap-2 px-2"
      :style="{ width: `${columnWidths.commit}px` }"
    >
      <span class="truncate font-medium">Uncommitted changes</span>
      <span class="shrink-0 text-[11px] text-[var(--color-fg-subtle)]">{{ summary }}</span>
    </div>
  </div>
</template>
