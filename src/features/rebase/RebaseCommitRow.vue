<script setup lang="ts">
import { GripVertical } from '@lucide/vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import type { MenuItem } from '@/components/ui/menu'
import { relativeTime } from '@/lib/format'
import type { RebasePlanEntry } from '@/stores/interactiveRebase'
import {
  REBASE_ACTION_LABELS,
  REBASE_ACTIONS,
  useInteractiveRebaseStore,
} from '@/stores/interactiveRebase'

const props = defineProps<{
  entry: RebasePlanEntry
  index: number
}>()

const rebase = useInteractiveRebaseStore()

const actionMenu = REBASE_ACTIONS.map(
  (action): MenuItem => ({
    label: REBASE_ACTION_LABELS[action],
    onSelect: () => rebase.setAction(props.index, action),
  }),
)

function onDragStart(event: DragEvent): void {
  rebase.setDragIndex(props.index)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(props.index))
  }
}

function onDragOver(event: DragEvent): void {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  const from = rebase.dragIndex ?? Number(event.dataTransfer?.getData('text/plain'))
  if (!Number.isFinite(from)) return
  rebase.moveEntry(from, props.index)
  rebase.setDragIndex(null)
}

function onDragEnd(): void {
  rebase.setDragIndex(null)
}
</script>

<template>
  <div
    class="group flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-raised)] px-2 py-2 transition-colors"
    :class="rebase.dragIndex === index ? 'opacity-60' : 'hover:border-[var(--color-border-strong)]'"
    draggable="true"
    @dragstart="onDragStart"
    @dragover="onDragOver"
    @drop="onDrop"
    @dragend="onDragEnd"
  >
    <button
      type="button"
      class="app-no-drag mt-0.5 cursor-grab rounded p-0.5 text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)] active:cursor-grabbing"
      aria-label="Drag to reorder"
    >
      <GripVertical :size="14" />
    </button>

    <div class="min-w-0 flex-1 space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <DropdownMenu :items="actionMenu" align="start">
          <button
            type="button"
            class="app-no-drag focus-ring rounded-md border border-[var(--color-border-strong)] bg-[var(--color-panel)] px-2 py-0.5 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-hover)]"
          >
            {{ REBASE_ACTION_LABELS[entry.action] }}
          </button>
        </DropdownMenu>
        <code class="font-mono text-[11px] text-[var(--color-fg-subtle)]">{{ entry.shortSha }}</code>
        <span class="truncate text-sm text-[var(--color-fg)]">{{ entry.subject }}</span>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-fg-subtle)]">
        <span>{{ entry.authorName }}</span>
        <span>·</span>
        <span>{{ relativeTime(new Date(entry.date)) }}</span>
      </div>

      <input
        v-if="entry.action === 'reword'"
        :value="entry.message"
        type="text"
        class="focus-ring app-no-drag w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-panel)] px-2.5 py-1.5 text-sm text-[var(--color-fg)] outline-none"
        placeholder="New commit message"
        @input="rebase.setMessage(index, ($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>
