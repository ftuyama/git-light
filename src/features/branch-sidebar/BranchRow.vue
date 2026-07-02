<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { ArrowDown, ArrowUp, Check, Cloud, Star } from '@lucide/vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import { branchMenuItems } from './branchMenuItems'
import { cn, laneColor } from '@/lib/utils'
import type { Branch } from '@/types/git'
import { useRepositoryStore } from '@/stores/repository'
import { useSelectionStore } from '@/stores/selection'
import { useBranchDragStore } from '@/stores/branchDrag'
import {
  readBranchDragPayload,
  setBranchDragPayload,
} from './useBranchDragDrop'

const props = defineProps<{ branch: Branch; depth?: number }>()
const repo = useRepositoryStore()
const selection = useSelectionStore()
const branchDrag = useBranchDragStore()
const { selectedBranchId } = storeToRefs(selection)

const dragEnabled = computed(
  () => !repo.branchSwitching && !repo.busyAction && !repo.inProgressOperation,
)
const isDragging = computed(() => branchDrag.draggingId === props.branch.id)
const isDropTarget = computed(() => branchDrag.dropTargetId === props.branch.id)
const canAcceptDrop = computed(
  () =>
    dragEnabled.value &&
    branchDrag.draggingId != null &&
    branchDrag.draggingId !== props.branch.id,
)

function findBranch(branchId: string): Branch | undefined {
  return repo.branches.find((branch) => branch.id === branchId)
}

function onDragStart(event: DragEvent): void {
  if (!dragEnabled.value || !event.dataTransfer) return
  setBranchDragPayload(event.dataTransfer, props.branch.id)
  branchDrag.startDrag(props.branch.id)
}

function onDragEnd(): void {
  branchDrag.clearDrag()
}

function onDragOver(event: DragEvent): void {
  if (!canAcceptDrop.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  branchDrag.setDropTarget(props.branch.id)
}

function onDragLeave(): void {
  if (branchDrag.dropTargetId === props.branch.id) {
    branchDrag.setDropTarget(null)
  }
}

function onClick(): void {
  if (isRemote.value) return
  selection.selectBranch(props.branch.id, props.branch.tipSha)
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  const sourceId = event.dataTransfer ? readBranchDragPayload(event.dataTransfer) : null
  branchDrag.clearDrag()
  if (!sourceId || sourceId === props.branch.id) return

  const source = findBranch(sourceId)
  if (!source) return

  branchDrag.pendingIntegrate = { source, target: props.branch }
}

const dotColor = computed(() => laneColor(props.branch.laneColorIndex))
const indent = computed(() => `${(props.depth ?? 0) * 14 + 24}px`)
const isRemote = computed(() => props.branch.kind === 'remote')
const isSidebarSelected = computed(() => selectedBranchId.value === props.branch.id)
const displayName = computed(() => {
  if (isRemote.value || !props.depth) return props.branch.name
  return props.branch.name.split('/').slice(1).join('/')
})

const menu = computed(() => branchMenuItems(repo, props.branch))
</script>

<template>
  <ContextMenu :items="menu">
    <div
      class="app-no-drag group/branch focus-ring flex h-7 items-center gap-2 rounded-md pr-1.5 text-[13px] transition-colors hover:bg-[var(--color-hover)]"
      :class="[
        branch.isCurrent ? 'bg-[var(--color-accent-soft)]' : '',
        isSidebarSelected && !branch.isCurrent ? 'bg-[var(--color-accent-soft)]/50 ring-1 ring-[var(--color-accent)] ring-inset' : '',
        isDragging ? 'opacity-40' : '',
        isDropTarget ? 'ring-2 ring-[var(--color-accent)] ring-inset' : '',
        dragEnabled ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
      ]"
      :aria-selected="isSidebarSelected"
      :style="{ paddingLeft: indent }"
      :draggable="dragEnabled"
      :title="dragEnabled ? 'Drag onto another branch to merge or rebase' : undefined"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
      @click="onClick"
      @dblclick="isRemote ? repo.checkoutRemoteBranch(branch) : repo.checkoutBranch(branch.name)"
    >
      <Cloud v-if="isRemote" :size="12" class="shrink-0 text-[var(--color-fg-subtle)]" />
      <span v-else class="size-2 shrink-0 rounded-full" :style="{ backgroundColor: dotColor }" />
      <span
        class="flex-1 truncate"
        :class="branch.isCurrent ? 'font-semibold text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
      >
        {{ displayName }}
      </span>

      <Check
        v-if="branch.isCurrent"
        :size="13"
        class="shrink-0 text-[var(--color-accent)]"
      />

      <span
        v-if="branch.ahead || branch.behind"
        class="flex shrink-0 items-center gap-1 font-mono text-[10px] text-[var(--color-fg-subtle)]"
      >
        <span v-if="branch.ahead" class="flex items-center"><ArrowUp :size="10" />{{ branch.ahead }}</span>
        <span v-if="branch.behind" class="flex items-center"><ArrowDown :size="10" />{{ branch.behind }}</span>
      </span>

      <button
        v-if="!isRemote"
        class="shrink-0 rounded p-0.5 transition-opacity"
        :class="
          cn(
            branch.isFavorite
              ? 'text-[var(--color-warning)] opacity-100'
              : 'text-[var(--color-fg-subtle)] opacity-0 group-hover/branch:opacity-100 hover:text-[var(--color-warning)]',
          )
        "
        :aria-label="branch.isFavorite ? 'Unpin branch' : 'Pin branch'"
        @click.stop="repo.toggleFavorite(branch.id)"
      >
        <Star :size="12" :fill="branch.isFavorite ? 'currentColor' : 'none'" />
      </button>
    </div>
  </ContextMenu>
</template>
