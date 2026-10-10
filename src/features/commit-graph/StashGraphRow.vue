<script setup lang="ts">
import { computed } from 'vue'
import { ArchiveRestore, ArrowDownToLine, Pencil, Trash2 } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import type { MenuItem } from '@/components/ui/menu'
import { relativeTime } from '@/lib/format'
import type { Stash } from '@/types/git'
import { useRepositoryStore } from '@/stores/repository'
import { useUiStore } from '@/stores/ui'

const props = defineProps<{
  stash: Stash
  graphWidth: number
  rowHeight: number
  selected: boolean
}>()

const repo = useRepositoryStore()
const ui = useUiStore()
const { columnWidths } = storeToRefs(ui)

const stashRef = computed(() => `stash@{${props.stash.index}}`)
/** Short GitKraken-style label: `WIP on <branch>`. */
const shortMessage = computed(() =>
  props.stash.branch ? `WIP on ${props.stash.branch}` : 'WIP',
)

const menu = computed<MenuItem[]>(() => [
  {
    label: 'Apply Stash',
    icon: ArrowDownToLine,
    onSelect: () => void repo.runAction({ kind: 'apply-stash', target: stashRef.value }),
  },
  {
    label: 'Pop Stash',
    icon: ArchiveRestore,
    onSelect: () => void repo.runAction({ kind: 'pop-stash', target: stashRef.value }),
  },
  {
    label: 'Delete Stash',
    icon: Trash2,
    danger: true,
    onSelect: () => void repo.runAction({ kind: 'drop-stash', target: stashRef.value }),
  },
  {
    label: 'Edit stash message',
    icon: Pencil,
    onSelect: () => void repo.renameStash(stashRef.value, props.stash.message),
  },
])
</script>

<template>
  <ContextMenu :items="menu">
    <div class="relative flex h-full items-center pr-3 pl-3 text-[13px]">
      <!-- Refs column stays empty: no branch/tag/stash badge. -->
      <div
        class="relative z-20 flex min-w-0 items-center gap-1 px-2"
        :style="{ width: `${columnWidths.refs}px` }"
        aria-hidden="true"
      />

      <!-- Graph column spacer; the dotted stash box is drawn in the graph overlay. -->
      <div
        class="relative z-0 flex shrink-0 items-center"
        :style="{ width: `${graphWidth}px`, height: `${rowHeight}px` }"
        aria-hidden="true"
      />

      <div
        class="relative flex h-full shrink-0 items-center gap-2 px-2"
        :style="{ width: `${columnWidths.commit}px` }"
      >
        <div
          class="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full bg-[var(--color-info)]"
        />
        <span
          class="truncate"
          :class="
            selected
              ? 'font-medium text-[var(--color-fg)]'
              : 'text-[var(--color-fg)]/90'
          "
        >
          {{ shortMessage }}
        </span>
        <span
          v-if="stash.filesChanged > 0"
          class="shrink-0 text-[11px] text-[var(--color-fg-subtle)]"
        >
          {{ stash.filesChanged }} files
        </span>
      </div>

      <div
        v-if="ui.isColumnVisible('author')"
        class="relative flex shrink-0 items-center justify-end gap-2 px-2"
        :style="{ width: `${columnWidths.author}px` }"
      />
      <span
        v-if="ui.isColumnVisible('sha')"
        class="relative shrink-0 truncate px-2 font-mono text-[11px] text-[var(--color-fg-subtle)]"
        :style="{ width: `${columnWidths.sha}px` }"
      >
        {{ stashRef }}
      </span>
      <span
        v-if="ui.isColumnVisible('when')"
        class="relative shrink-0 truncate px-2 text-right text-[11px] text-[var(--color-fg-subtle)]"
        :style="{ width: `${columnWidths.when}px` }"
      >
        {{ relativeTime(stash.date) }}
      </span>
    </div>
  </ContextMenu>
</template>
