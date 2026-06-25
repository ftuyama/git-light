<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  Check,
  GitBranch,
  GitCompare,
  Pencil,
  Star,
  Trash2,
} from '@lucide/vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import type { MenuItem } from '@/components/ui/menu'
import { cn, laneColor } from '@/lib/utils'
import type { Branch } from '@/types/git'
import { useRepositoryStore } from '@/stores/repository'

const props = defineProps<{ branch: Branch; depth?: number }>()
const repo = useRepositoryStore()

const dotColor = computed(() => laneColor(props.branch.laneColorIndex))
const indent = computed(() => `${(props.depth ?? 0) * 14 + 24}px`)

const menu = computed<MenuItem[]>(() => [
  { label: 'Checkout', icon: Check, onSelect: () => repo.checkoutBranch(props.branch.name) },
  { label: 'Create Branch Here', icon: GitBranch, onSelect: () => action('create-branch') },
  { separator: true },
  { label: 'Rename', icon: Pencil, onSelect: () => action('rename-branch') },
  { label: 'Compare with Current', icon: GitCompare, onSelect: () => action('compare-branches') },
  {
    label: props.branch.isFavorite ? 'Unpin' : 'Pin to Favorites',
    icon: Star,
    onSelect: () => repo.toggleFavorite(props.branch.id),
  },
  { separator: true },
  { label: 'Delete', icon: Trash2, danger: true, onSelect: () => action('delete-branch') },
])

function action(kind: Parameters<typeof repo.runAction>[0]['kind']): void {
  void repo.runAction({ kind, target: props.branch.name })
}
</script>

<template>
  <ContextMenu :items="menu">
    <div
      class="group/branch focus-ring flex h-7 cursor-pointer items-center gap-2 rounded-md pr-1.5 text-[13px] transition-colors hover:bg-[var(--color-hover)]"
      :class="branch.isCurrent ? 'bg-[var(--color-accent-soft)]' : ''"
      :style="{ paddingLeft: indent }"
      @dblclick="repo.checkoutBranch(branch.name)"
    >
      <span class="size-2 shrink-0 rounded-full" :style="{ backgroundColor: dotColor }" />
      <span
        class="flex-1 truncate"
        :class="branch.isCurrent ? 'font-semibold text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
      >
        {{ depth ? branch.name.split('/').slice(1).join('/') : branch.name }}
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
