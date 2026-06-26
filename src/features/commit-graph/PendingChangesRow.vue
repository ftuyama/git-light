<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import RefChip from './RefChip.vue'
import { useRepositoryStore } from '@/stores/repository'
import { useUiStore } from '@/stores/ui'
import type { Ref } from '@/types/git'

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

const branchRef = computed((): Ref | null => {
  const branch = repo.currentBranch
  if (!branch) return null
  return {
    type: branch.kind === 'remote' ? 'remoteBranch' : 'localBranch',
    name: branch.name,
    label: branch.name,
    isHead: true,
  }
})

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
    >
      <RefChip
        v-if="branchRef"
        class="min-w-0 overflow-hidden"
        :ref-data="branchRef"
        color="var(--color-accent)"
      />
    </div>

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
