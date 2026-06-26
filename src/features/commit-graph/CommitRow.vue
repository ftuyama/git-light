<script setup lang="ts">
import { computed } from 'vue'
import {
  Check,
  Cherry,
  Copy,
  ExternalLink,
  GitBranch,
  GitMerge,
  ListTree,
  RotateCcw,
  Spline,
  Tag as TagIcon,
} from '@lucide/vue'
import Avatar from '@/components/ui/Avatar.vue'
import Badge from '@/components/ui/Badge.vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import RefChip from './RefChip.vue'
import type { MenuItem } from '@/components/ui/menu'
import { relativeTime } from '@/lib/format'
import { formatRefLabel } from '@shared/git/refLabel'
import { githubCommitUrl } from '@shared/git/githubUrl'
import type { Commit, Ref } from '@/types/git'
import type { GraphNode } from '@/lib/graph/computeGraphLayout'
import { useRepositoryStore } from '@/stores/repository'
import { useInteractiveRebaseStore } from '@/stores/interactiveRebase'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'
import { storeToRefs } from 'pinia'

const props = defineProps<{
  commit: Commit
  graphNode: GraphNode | null
  graphWidth: number
  nodeX: number
  nodeSize: number
  rowHeight: number
  selected: boolean
}>()

const repo = useRepositoryStore()
const interactiveRebase = useInteractiveRebaseStore()
const toast = useToastStore()
const ui = useUiStore()
const { columnWidths } = storeToRefs(ui)

function refDisplayLabel(ref: Ref): string {
  return ref.label || formatRefLabel(ref.name, ref.type)
}

function refPriority(ref: Ref): number {
  if (ref.isHead) return 0
  if (ref.type === 'localBranch') return 1
  if (ref.type === 'remoteBranch') return 2
  return 3
}

const displayRefs = computed(() => {
  const byLabel = new Map<string, Ref>()
  for (const ref of props.commit.refs) {
    if (ref.type === 'head') continue
    const label = refDisplayLabel(ref)
    const existing = byLabel.get(label)
    if (!existing || refPriority(ref) < refPriority(existing)) {
      byLabel.set(label, ref)
    }
  }
  return [...byLabel.values()].sort((a, b) => {
    const byPriority = refPriority(a) - refPriority(b)
    if (byPriority !== 0) return byPriority
    return refDisplayLabel(a).localeCompare(refDisplayLabel(b))
  })
})

const primaryRef = computed(() => displayRefs.value[0] ?? null)
const hiddenRefs = computed(() => displayRefs.value.slice(1))
const hiddenCount = computed(() => hiddenRefs.value.length)

const isCurrentBranchRef = computed(() => primaryRef.value?.isHead === true)

const chipColor = computed(() => {
  if (isCurrentBranchRef.value) return 'var(--color-accent)'
  return props.graphNode?.color ?? 'var(--color-fg-muted)'
})

const showConnector = computed(
  () =>
    props.graphNode != null &&
    primaryRef.value != null &&
    (primaryRef.value.type === 'localBranch' || primaryRef.value.type === 'remoteBranch'),
)

const connectorColor = computed((): Record<string, string> | null => {
  if (!showConnector.value || !props.graphNode) return null
  return {
    backgroundColor: isCurrentBranchRef.value
      ? 'var(--color-accent)'
      : props.graphNode.color,
  }
})

const REFS_RIGHT_PADDING = 8

const connectorStyle = computed((): Record<string, string> | null => {
  if (!connectorColor.value) return null
  const toNode = REFS_RIGHT_PADDING + props.nodeX - props.nodeSize / 2
  const width = Math.max(0, Math.min(toNode, props.graphWidth + REFS_RIGHT_PADDING))
  return {
    ...connectorColor.value,
    width: `${width}px`,
  }
})

const menu = computed<MenuItem[]>(() => [
  { label: 'Checkout Commit', icon: Check, onSelect: () => act('checkout') },
  { label: 'Create Branch Here', icon: GitBranch, onSelect: () => act('create-branch') },
  { label: 'Tag Commit', icon: TagIcon, onSelect: () => act('tag') },
  { separator: true },
  { label: 'Cherry Pick', icon: Cherry, onSelect: () => act('cherry-pick') },
  { label: 'Merge into Current', icon: GitMerge, onSelect: () => act('merge') },
  { label: 'Rebase From Here', icon: Spline, onSelect: () => act('rebase-from-here') },
  { label: 'Interactive Rebase From Here', icon: ListTree, onSelect: () => interactiveRebase.open(props.commit.sha) },
  {
    label: 'Reset Current Branch to Here',
    icon: RotateCcw,
    children: [
      { label: 'Soft', shortcut: '--soft', onSelect: () => act('reset-soft') },
      { label: 'Mixed', shortcut: '--mixed', onSelect: () => act('reset-mixed') },
      { label: 'Hard', shortcut: '--hard', danger: true, onSelect: () => act('reset-hard') },
    ],
  },
  { separator: true },
  { label: 'Copy SHA', icon: Copy, shortcut: '⌘C', onSelect: copySha },
  { label: 'Open on GitHub', icon: ExternalLink, onSelect: openOnGithub },
])

function act(kind: Parameters<typeof repo.runAction>[0]['kind']): void {
  void repo.runAction({ kind, target: props.commit.shortSha })
}

function copySha(): void {
  void navigator.clipboard?.writeText(props.commit.sha)
  toast.push('Copied SHA to clipboard', 'info')
}

function openOnGithub(): void {
  const remoteUrl = repo.repository?.remoteUrl ?? ''
  const url = githubCommitUrl(remoteUrl, props.commit.sha)
  if (!url) {
    toast.push('No GitHub remote configured for this repository', 'error')
    return
  }
  void window.electron?.openExternal(url)
  toast.push('Opening commit on GitHub', 'info')
}
</script>

<template>
  <ContextMenu :items="menu">
    <div class="relative flex h-full items-center pr-3 pl-3 text-[13px]">
      <div
        class="group/refs relative z-20 flex min-w-0 items-center gap-1 px-2"
        :style="{ width: `${columnWidths.refs}px` }"
      >
        <template v-if="primaryRef">
          <div class="relative min-w-0 flex-1">
            <RefChip class="min-w-0 overflow-hidden" :ref-data="primaryRef" :color="chipColor" />
            <div
              v-if="connectorStyle"
              class="pointer-events-none absolute top-1/2 z-10 h-[2px] -translate-y-1/2"
              :class="isCurrentBranchRef ? 'opacity-90' : 'opacity-40'"
              :style="{ left: '100%', ...connectorStyle }"
            />
          </div>
          <span
            v-if="hiddenCount"
            class="absolute top-1/2 right-1 shrink-0 -translate-y-1/2 rounded px-0.5 text-[10px] text-[var(--color-fg-subtle)] group-hover/refs:text-[var(--color-fg-muted)]"
          >
            +{{ hiddenCount }}
          </span>
          <div
            v-if="hiddenCount"
            class="pointer-events-none absolute bottom-full left-1 z-20 mb-1 hidden min-w-max flex-col gap-1 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-2 py-1.5 shadow-lg shadow-black/40 group-hover/refs:flex"
          >
            <RefChip v-for="(ref, i) in hiddenRefs" :key="i" :ref-data="ref" :color="chipColor" />
          </div>
        </template>
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
        <Cherry
          v-if="commit.isCherryPick"
          :size="13"
          class="shrink-0 text-[var(--color-lane-4)]"
        />
        <span
          class="truncate"
          :class="selected ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg)]/90'"
        >
          {{ commit.subject }}
        </span>
        <Badge v-if="commit.isMerge" tone="info">merge</Badge>
      </div>

      <div
        v-if="ui.isColumnVisible('author')"
        class="relative flex shrink-0 items-center justify-end gap-2 px-2"
        :style="{ width: `${columnWidths.author}px` }"
      >
        <Avatar :author="commit.author" :size="18" />
        <span class="min-w-0 truncate text-right text-[var(--color-fg-muted)]">
          {{ commit.author.name }}
        </span>
      </div>
      <span
        v-if="ui.isColumnVisible('sha')"
        class="relative shrink-0 truncate px-2 font-mono text-[11px] text-[var(--color-fg-subtle)]"
        :style="{ width: `${columnWidths.sha}px` }"
      >
        {{ commit.shortSha }}
      </span>
      <span
        v-if="ui.isColumnVisible('when')"
        class="relative shrink-0 truncate px-2 text-right text-[11px] text-[var(--color-fg-subtle)]"
        :style="{ width: `${columnWidths.when}px` }"
      >
        {{ relativeTime(commit.date) }}
      </span>
    </div>
  </ContextMenu>
</template>
