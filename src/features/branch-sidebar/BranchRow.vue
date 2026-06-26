<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Cloud,
  GitBranch,
  GitCompare,
  Link,
  Pencil,
  Star,
  Trash2,
} from '@lucide/vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import type { MenuItem } from '@/components/ui/menu'
import { cn, laneColor } from '@/lib/utils'
import type { Branch } from '@/types/git'
import { useRepositoryStore } from '@/stores/repository'
import {
  branchDragState,
  pendingBranchIntegrate,
  readBranchDragPayload,
  setBranchDragPayload,
} from './useBranchDragDrop'

const props = defineProps<{ branch: Branch; depth?: number }>()
const repo = useRepositoryStore()

const dragEnabled = computed(
  () => !repo.branchSwitching && !repo.busyAction && !repo.inProgressOperation,
)
const isDragging = computed(() => branchDragState.draggingId === props.branch.id)
const isDropTarget = computed(() => branchDragState.dropTargetId === props.branch.id)
const canAcceptDrop = computed(
  () =>
    dragEnabled.value &&
    branchDragState.draggingId != null &&
    branchDragState.draggingId !== props.branch.id,
)

function findBranch(branchId: string): Branch | undefined {
  return repo.branches.find((branch) => branch.id === branchId)
}

function onDragStart(event: DragEvent): void {
  if (!dragEnabled.value || !event.dataTransfer) return
  setBranchDragPayload(event.dataTransfer, props.branch.id)
  branchDragState.draggingId = props.branch.id
}

function onDragEnd(): void {
  branchDragState.draggingId = null
  branchDragState.dropTargetId = null
}

function onDragOver(event: DragEvent): void {
  if (!canAcceptDrop.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  branchDragState.dropTargetId = props.branch.id
}

function onDragLeave(): void {
  if (branchDragState.dropTargetId === props.branch.id) {
    branchDragState.dropTargetId = null
  }
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  const sourceId = event.dataTransfer ? readBranchDragPayload(event.dataTransfer) : null
  branchDragState.draggingId = null
  branchDragState.dropTargetId = null
  if (!sourceId || sourceId === props.branch.id) return

  const source = findBranch(sourceId)
  if (!source) return

  pendingBranchIntegrate.value = { source, target: props.branch }
}

const dotColor = computed(() => laneColor(props.branch.laneColorIndex))
const indent = computed(() => `${(props.depth ?? 0) * 14 + 24}px`)
const isRemote = computed(() => props.branch.kind === 'remote')
const displayName = computed(() => {
  if (isRemote.value || !props.depth) return props.branch.name
  return props.branch.name.split('/').slice(1).join('/')
})

const menu = computed<MenuItem[]>(() => {
  if (isRemote.value) {
    return [
      {
        label: 'Checkout Local Branch',
        icon: Check,
        onSelect: () => repo.checkoutRemoteBranch(props.branch),
      },
      {
        label: 'Delete Remote Branch',
        icon: Trash2,
        danger: true,
        onSelect: () => void repo.runAction({ kind: 'delete-remote-branch', target: props.branch.name }),
      },
    ]
  }

  return [
    { label: 'Checkout', icon: Check, onSelect: () => repo.checkoutBranch(props.branch.name) },
    { label: 'Create Branch Here', icon: GitBranch, onSelect: () => repo.createBranch(props.branch.name) },
    { separator: true },
    { label: 'Rename', icon: Pencil, onSelect: () => repo.renameBranch(props.branch.name) },
    { label: 'Set Upstream', icon: Link, onSelect: () => repo.setUpstream(props.branch.name) },
    { label: 'Compare with Current', icon: GitCompare, onSelect: () =>
      void repo.runAction({
        kind: 'compare-branches',
        target: props.branch.name,
        meta: { other: repo.currentBranch?.name },
      }),
    },
    {
      label: props.branch.isFavorite ? 'Unpin' : 'Pin to Favorites',
      icon: Star,
      onSelect: () => repo.toggleFavorite(props.branch.id),
    },
    { separator: true },
    {
      label: 'Delete',
      icon: Trash2,
      danger: true,
      onSelect: () => repo.deleteBranch(props.branch.name),
    },
  ]
})
</script>

<template>
  <ContextMenu :items="menu">
    <div
      class="app-no-drag group/branch focus-ring flex h-7 items-center gap-2 rounded-md pr-1.5 text-[13px] transition-colors hover:bg-[var(--color-hover)]"
      :class="[
        branch.isCurrent ? 'bg-[var(--color-accent-soft)]' : '',
        isDragging ? 'opacity-40' : '',
        isDropTarget ? 'ring-2 ring-[var(--color-accent)] ring-inset' : '',
        dragEnabled ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
      ]"
      :style="{ paddingLeft: indent }"
      :draggable="dragEnabled"
      :title="dragEnabled ? 'Drag onto another branch to merge or rebase' : undefined"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
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
