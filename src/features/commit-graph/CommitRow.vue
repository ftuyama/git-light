<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
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
  Undo2,
} from '@lucide/vue'
import Avatar from '@/components/ui/Avatar.vue'
import Badge from '@/components/ui/Badge.vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import RefChip from './RefChip.vue'
import BranchRefChip from './BranchRefChip.vue'
import BranchNameChipInput from './BranchNameChipInput.vue'
import { useBranchInputFocus } from './composables/useBranchInputFocus'
import type { MenuItem } from '@/components/ui/menu'
import { relativeTime } from '@/lib/format'
import { formatRefLabel } from '@shared/git/refLabel'
import { githubCommitUrl } from '@shared/git/githubUrl'
import type { Commit, Ref } from '@/types/git'
import type { GraphNode } from '@/lib/graph/computeGraphLayout'
import { findLaneBranchPreview } from '@/lib/graph/commitLaneBranchPreview'
import { useRepositoryStore } from '@/stores/repository'
import { useInteractiveRebaseStore } from '@/stores/interactiveRebase'
import { useSelectionStore, PENDING_BRANCH_ROW } from '@/stores/selection'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'
import { storeToRefs } from 'pinia'
import { ROW_LEFT_PADDING } from './composables/useCommitGraphColumns'

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
const selection = useSelectionStore()
const interactiveRebase = useInteractiveRebaseStore()
const toast = useToastStore()
const ui = useUiStore()
const { columnWidths } = storeToRefs(ui)
const { hoveredSha, branchCreation } = storeToRefs(selection)

function refDisplayLabel(ref: Ref): string {
  return ref.label || formatRefLabel(ref.name, ref.type)
}

function refPriority(ref: Ref): number {
  if (ref.isHead) return 0
  if (ref.type === 'localBranch') return 1
  if (ref.type === 'remoteBranch') return 2
  return 3
}

interface DisplayRef {
  ref: Ref
  hasLocal: boolean
  hasRemote: boolean
}

function branchPresence(refs: Ref[]): { hasLocal: boolean; hasRemote: boolean } {
  return {
    hasLocal: refs.some((r) => r.type === 'localBranch'),
    hasRemote: refs.some((r) => r.type === 'remoteBranch'),
  }
}

const displayRefs = computed((): DisplayRef[] => {
  const byLabel = new Map<string, Ref>()
  const refsByLabel = new Map<string, Ref[]>()
  for (const ref of props.commit.refs) {
    if (ref.type === 'head') continue
    const label = refDisplayLabel(ref)
    const group = refsByLabel.get(label) ?? []
    group.push(ref)
    refsByLabel.set(label, group)
    const existing = byLabel.get(label)
    if (!existing || refPriority(ref) < refPriority(existing)) {
      byLabel.set(label, ref)
    }
  }
  return [...byLabel.entries()]
    .map(([label, ref]) => ({
      ref,
      ...branchPresence(refsByLabel.get(label) ?? []),
    }))
    .sort((a, b) => {
      const byPriority = refPriority(a.ref) - refPriority(b.ref)
      if (byPriority !== 0) return byPriority
      return refDisplayLabel(a.ref).localeCompare(refDisplayLabel(b.ref))
    })
})

const primaryRef = computed(() => displayRefs.value[0] ?? null)
const hiddenRefs = computed(() => displayRefs.value.slice(1))
const hiddenCount = computed(() => hiddenRefs.value.length)

const hasBranchRef = computed(() =>
  props.commit.refs.some((r) => r.type === 'localBranch' || r.type === 'remoteBranch'),
)

const isHovered = computed(() => hoveredSha.value === props.commit.sha)

const commitIndex = computed(() => repo.commits.findIndex((c) => c.sha === props.commit.sha))

const isCreatingBranchHere = computed(() => {
  const creation = branchCreation.value
  if (!creation || creation.display === PENDING_BRANCH_ROW) return false
  return creation.display === props.commit.sha
})

const previewBranch = computed(() => {
  if (isCreatingBranchHere.value) return null
  if (!isHovered.value || hasBranchRef.value) return null
  const index = commitIndex.value
  if (index < 0) return null
  return findLaneBranchPreview(index, repo.commits, repo.layout, repo.branches)
})

const isCurrentBranchRef = computed(() => primaryRef.value?.ref.isHead === true)

const branchInputRef = useTemplateRef('branchInputRef')

useBranchInputFocus(isCreatingBranchHere, branchInputRef)

const chipColor = computed(() => props.graphNode?.color ?? 'var(--color-fg-muted)')

const showConnector = computed(
  () =>
    props.graphNode != null &&
    primaryRef.value != null &&
    (primaryRef.value.ref.type === 'localBranch' || primaryRef.value.ref.type === 'remoteBranch'),
)

const connectorColor = computed((): Record<string, string> | null => {
  if (!showConnector.value || !props.graphNode) return null
  return {
    backgroundColor: props.graphNode.color,
  }
})

const REFS_RIGHT_PADDING = 8

const connectorStyle = computed((): Record<string, string> | null => {
  if (!connectorColor.value) return null
  const toNode =
    REFS_RIGHT_PADDING + props.nodeX - props.nodeSize / 2 - ROW_LEFT_PADDING
  const width = Math.max(
    0,
    Math.min(toNode, props.graphWidth + REFS_RIGHT_PADDING - ROW_LEFT_PADDING),
  )
  return {
    ...connectorColor.value,
    width: `${width}px`,
  }
})

const showPreviewConnector = computed(
  () => props.graphNode != null && (previewBranch.value != null || isCreatingBranchHere.value),
)

const previewConnectorStyle = computed((): Record<string, string> | null => {
  if (!showPreviewConnector.value || !props.graphNode) return null
  const toNode =
    REFS_RIGHT_PADDING + props.nodeX - props.nodeSize / 2 - ROW_LEFT_PADDING
  const width = Math.max(
    0,
    Math.min(toNode, props.graphWidth + REFS_RIGHT_PADDING - ROW_LEFT_PADDING),
  )
  return {
    backgroundColor: props.graphNode.color,
    width: `${width}px`,
  }
})

const menu = computed<MenuItem[]>(() => {
  const items: MenuItem[] = [
    { label: 'Checkout Commit', icon: Check, onSelect: () => act('checkout') },
    { label: 'Create Branch Here', icon: GitBranch, onSelect: () => beginBranchHere() },
  ]

  if (ui.isAdvanced) {
    items.push({ label: 'Tag Commit', icon: TagIcon, onSelect: () => act('tag') })
  }

  items.push({ separator: true })

  if (ui.isAdvanced) {
    items.push({ label: 'Cherry Pick', icon: Cherry, onSelect: () => act('cherry-pick') })
    items.push({ label: 'Revert Commit', icon: Undo2, onSelect: () => act('revert') })
  }

  items.push({ label: 'Merge into Current', icon: GitMerge, onSelect: () => act('merge') })

  if (ui.isAdvanced) {
    items.push(
      { label: 'Rebase From Here', icon: Spline, onSelect: () => act('rebase-from-here') },
      {
        label: 'Interactive Rebase From Here',
        icon: ListTree,
        onSelect: () => interactiveRebase.open(props.commit.sha),
      },
    )
  }

  items.push(
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
  )

  return items
})

function beginBranchHere(): void {
  void repo.beginCreateBranch({ startPoint: props.commit.sha, sha: props.commit.sha })
}

function onBranchNameSubmit(name: string): void {
  void repo.submitBranchCreation(name)
}

function onBranchNameCancel(): void {
  selection.cancelBranchCreation()
}

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
        <RefChip
          v-if="primaryRef && !hasBranchRef && !isCreatingBranchHere"
          class="shrink-0 overflow-hidden"
          :ref-data="primaryRef.ref"
          :color="chipColor"
          :has-local="primaryRef.hasLocal"
          :has-remote="primaryRef.hasRemote"
        />
        <div v-if="isCreatingBranchHere" class="relative min-w-0 flex-1">
          <BranchNameChipInput
            ref="branchInputRef"
            class="min-w-0 overflow-hidden"
            :color="chipColor"
            @submit="onBranchNameSubmit"
            @cancel="onBranchNameCancel"
          />
          <div
            v-if="previewConnectorStyle"
            class="pointer-events-none absolute top-1/2 z-10 h-[2px] -translate-y-1/2 opacity-90"
            :style="{ left: '100%', ...previewConnectorStyle }"
          />
        </div>
        <div v-else-if="previewBranch" class="relative min-w-0 flex-1">
          <BranchRefChip
            class="min-w-0 overflow-hidden"
            :ref-data="previewBranch.ref"
            :color="chipColor"
            :has-local="previewBranch.hasLocal"
            :has-remote="previewBranch.hasRemote"
            muted
          />
          <div
            v-if="previewConnectorStyle"
            class="pointer-events-none absolute top-1/2 z-10 h-[2px] -translate-y-1/2 opacity-25"
            :style="{ left: '100%', ...previewConnectorStyle }"
          />
        </div>
        <template v-if="hasBranchRef && primaryRef && !isCreatingBranchHere">
          <div class="relative min-w-0 flex-1">
            <BranchRefChip
              class="min-w-0 overflow-hidden"
              :ref-data="primaryRef.ref"
              :color="chipColor"
              :has-local="primaryRef.hasLocal"
              :has-remote="primaryRef.hasRemote"
            />
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
            class="pointer-events-none absolute top-full left-1 z-50 mt-1 hidden min-w-max flex-col gap-1 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-2 py-1.5 shadow-lg shadow-black/40 group-hover/refs:flex"
          >
            <BranchRefChip
              v-for="(entry, i) in hiddenRefs"
              :key="i"
              :ref-data="entry.ref"
              :color="chipColor"
              :has-local="entry.hasLocal"
              :has-remote="entry.hasRemote"
            />
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
