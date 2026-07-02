<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { storeToRefs } from 'pinia'
import BranchNameChipInput from './BranchNameChipInput.vue'
import { useBranchInputFocus } from './composables/useBranchInputFocus'
import { ROW_LEFT_PADDING } from './composables/useCommitGraphColumns'
import { useRepositoryStore } from '@/stores/repository'
import { PENDING_BRANCH_ROW, useSelectionStore } from '@/stores/selection'
import { useUiStore } from '@/stores/ui'

const props = defineProps<{
  graphWidth: number
  nodeX: number
  nodeSize: number
  rowHeight: number
  selected: boolean
}>()

const repo = useRepositoryStore()
const selection = useSelectionStore()
const ui = useUiStore()
const { columnWidths } = storeToRefs(ui)
const { branchCreation } = storeToRefs(selection)

const changedCount = computed(() => repo.workingTree.length)
const stagedCount = computed(() => repo.stagedFiles.length)
const unstagedCount = computed(() => repo.unstagedFiles.length)

const summary = computed(() => {
  const parts: string[] = []
  if (unstagedCount.value) parts.push(`${unstagedCount.value} changed`)
  if (stagedCount.value) parts.push(`${stagedCount.value} staged`)
  return parts.length ? parts.join(' · ') : `${changedCount.value} files`
})

const isCreatingBranch = computed(
  () => branchCreation.value?.display === PENDING_BRANCH_ROW,
)

const branchInputRef = useTemplateRef('branchInputRef')

useBranchInputFocus(isCreatingBranch, branchInputRef)

const headNode = computed(() => repo.layout.nodes[repo.headCommitIndex] ?? null)
const chipColor = computed(() => headNode.value?.color ?? 'var(--color-fg-muted)')

const REFS_RIGHT_PADDING = 8

const connectorStyle = computed((): Record<string, string> | null => {
  if (!headNode.value) return null
  const toNode =
    REFS_RIGHT_PADDING + props.nodeX - props.nodeSize / 2 - ROW_LEFT_PADDING
  const width = Math.max(
    0,
    Math.min(toNode, props.graphWidth + REFS_RIGHT_PADDING - ROW_LEFT_PADDING),
  )
  return {
    backgroundColor: headNode.value.color,
    width: `${width}px`,
  }
})

function onBranchNameSubmit(name: string): void {
  void repo.submitBranchCreation(name)
}

function onBranchNameCancel(): void {
  selection.cancelBranchCreation()
}
</script>

<template>
  <div
    class="relative flex h-full items-center pr-3 pl-3 text-[13px]"
    :class="selected ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg)]/90'"
  >
    <div
      class="group/refs relative z-20 flex min-w-0 items-center gap-1 px-2"
      :style="{ width: `${columnWidths.refs}px` }"
    >
      <div v-if="isCreatingBranch" class="relative min-w-0 flex-1">
        <BranchNameChipInput
          ref="branchInputRef"
          class="min-w-0 overflow-hidden"
          :color="chipColor"
          @submit="onBranchNameSubmit"
          @cancel="onBranchNameCancel"
        />
        <div
          v-if="connectorStyle"
          class="pointer-events-none absolute top-1/2 z-10 h-[2px] -translate-y-1/2 opacity-90"
          :style="{ left: '100%', ...connectorStyle }"
        />
      </div>
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
