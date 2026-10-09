<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { storeToRefs } from 'pinia'
import BranchNameChipInput from './BranchNameChipInput.vue'
import { useBranchInputFocus } from './composables/useBranchInputFocus'
import { ROW_LEFT_PADDING } from './composables/useCommitGraphColumns'
import { useRepositoryStore } from '@/stores/repository'
import { PENDING_BRANCH_ROW, useSelectionStore } from '@/stores/selection'
import { useUiStore } from '@/stores/ui'
import { STATUS_META } from '@/features/working-tree/fileStatus'
import type { FileStatus } from '@/types/git'

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
const { commitMessage } = storeToRefs(repo)

const MESSAGE_PLACEHOLDER = '// WIP'

const changedCount = computed(() => repo.workingTree.length)

const messageWidth = computed(() => {
  const len = commitMessage.value.length || MESSAGE_PLACEHOLDER.length
  return `${len + 1}ch`
})

interface StatusGroup {
  status: FileStatus
  count: number
}

const statusBreakdown = computed<StatusGroup[]>(() => {
  const counts = new Map<FileStatus, number>()
  for (const file of repo.workingTree) {
    counts.set(file.status, (counts.get(file.status) ?? 0) + 1)
  }
  const added = (counts.get('added') ?? 0) + (counts.get('untracked') ?? 0)
  const groups: StatusGroup[] = []
  if (counts.get('modified')) groups.push({ status: 'modified', count: counts.get('modified')! })
  if (added) groups.push({ status: 'added', count: added })
  if (counts.get('deleted')) groups.push({ status: 'deleted', count: counts.get('deleted')! })
  if (counts.get('renamed')) groups.push({ status: 'renamed', count: counts.get('renamed')! })
  if (counts.get('copied')) groups.push({ status: 'copied', count: counts.get('copied')! })
  if (counts.get('conflicted'))
    groups.push({ status: 'conflicted', count: counts.get('conflicted')! })
  if (counts.get('ignored')) groups.push({ status: 'ignored', count: counts.get('ignored')! })
  if (!groups.length && changedCount.value)
    groups.push({ status: 'modified', count: changedCount.value })
  return groups
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
      <input
        v-model="commitMessage"
        type="text"
        :placeholder="MESSAGE_PLACEHOLDER"
        spellcheck="false"
        aria-label="Commit message"
        :style="{ width: messageWidth }"
        class="w-auto min-w-[4ch] max-w-full shrink truncate bg-transparent font-mono text-[13px] text-[var(--color-fg-muted)] placeholder:text-[var(--color-fg-subtle)]/60 focus:outline-none"
      />
      <span class="flex shrink-0 items-center gap-2 text-[11px] text-[var(--color-fg-subtle)]">
        <span
          v-for="group in statusBreakdown"
          :key="group.status"
          class="flex items-center gap-1"
          :title="STATUS_META[group.status].label"
        >
          <component
            :is="STATUS_META[group.status].icon"
            v-if="STATUS_META[group.status].icon"
            :size="12"
            :style="{ color: STATUS_META[group.status].color }"
          />
          <span v-else class="font-mono" :style="{ color: STATUS_META[group.status].color }">
            {{ STATUS_META[group.status].letter }}
          </span>
          <span>{{ group.count }}</span>
        </span>
      </span>
    </div>
  </div>
</template>
