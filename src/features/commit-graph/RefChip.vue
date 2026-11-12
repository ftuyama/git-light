<script setup lang="ts">
import { computed, onUnmounted, ref, useTemplateRef } from 'vue'
import { Check, Cloud, Monitor, Tag as TagIcon, TreePine } from '@lucide/vue'
import { formatRefLabel } from '@shared/git/refLabel'
import type { Ref } from '@/types/git'
import { useRepositoryStore } from '@/stores/repository'

const props = defineProps<{
  refData: Ref
  color: string
  /** When set, overrides type-based local icon visibility (e.g. merged local+remote). */
  hasLocal?: boolean
  /** When set, overrides type-based remote icon visibility (e.g. merged local+remote). */
  hasRemote?: boolean
  /** Reduced opacity for hover preview chips that are not branch tips. */
  muted?: boolean
}>()

const label = computed(() =>
  props.refData.label
    ? props.refData.label
    : formatRefLabel(props.refData.name, props.refData.type),
)

const repo = useRepositoryStore()

const isCurrent = computed(() => props.refData.isHead === true)
const showLocalIcon = computed(
  () => props.hasLocal ?? props.refData.type === 'localBranch',
)
const showRemoteIcon = computed(
  () => props.hasRemote ?? props.refData.type === 'remoteBranch',
)
const showTagIcon = computed(() => props.refData.type === 'tag')

/** Linked worktree holding this local branch, when it is not the checkout this app has open. */
const worktree = computed(() => {
  if (props.refData.type !== 'localBranch') return undefined
  const name = formatRefLabel(props.refData.name, 'localBranch')
  const repoPath = repo.repository?.path?.replace(/\/+$/, '')
  return repo.worktrees.find(
    (entry) => entry.branch === name && entry.path.replace(/\/+$/, '') !== repoPath,
  )
})

const resolvedColor = computed((): string =>
  props.refData.type === 'tag' ? 'var(--color-warning)' : props.color,
)

const hovered = ref(false)

const chipStyle = computed(() => {
  const hover = hovered.value
  const mix = isCurrent.value ? (hover ? 54 : 44) : hover ? 50 : 38
  const borderMix = isCurrent.value ? (hover ? 92 : 78) : hover ? 92 : 72
  const textColor = isCurrent.value
    ? 'var(--color-fg)'
    : `color-mix(in srgb, ${resolvedColor.value} ${hover ? 62 : 50}%, var(--color-fg))`
  return {
    color: textColor,
    backgroundColor: `color-mix(in srgb, ${resolvedColor.value} ${mix}%, var(--color-panel-raised))`,
    border: `1px solid color-mix(in srgb, ${resolvedColor.value} ${borderMix}%, var(--color-border-strong))`,
    boxShadow: hover
      ? `0 0 0 1px color-mix(in srgb, ${resolvedColor.value} 45%, transparent)`
      : 'none',
  }
})

const anchorRef = useTemplateRef('anchorRef')
const labelRef = useTemplateRef('labelRef')
const expanded = ref(false)
const anchorRect = ref({ top: 0, left: 0, width: 0, height: 22 })

let leaveTimer: ReturnType<typeof setTimeout> | undefined

function onChipEnter(): void {
  hovered.value = true
  expand()
}

function onChipLeave(): void {
  if (expanded.value) {
    // Keep the highlight until the expand overlay actually collapses.
    scheduleCollapse()
    return
  }
  hovered.value = false
}

function expand(): void {
  cancelCollapse()

  const anchor = anchorRef.value
  const labelEl = labelRef.value
  if (!anchor || !labelEl) return
  if (labelEl.scrollWidth <= labelEl.clientWidth) return

  const rect = anchor.getBoundingClientRect()
  anchorRect.value = {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }
  expanded.value = true
}

function collapse(): void {
  cancelCollapse()
  expanded.value = false
  hovered.value = false
}

function cancelCollapse(): void {
  if (leaveTimer !== undefined) {
    clearTimeout(leaveTimer)
    leaveTimer = undefined
  }
}

function scheduleCollapse(): void {
  cancelCollapse()
  leaveTimer = setTimeout(collapse, 100)
}

function onScroll(): void {
  if (expanded.value) collapse()
}

window.addEventListener('scroll', onScroll, true)
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll, true)
  cancelCollapse()
})
</script>

<template>
  <span
    class="block h-[22px] w-fit min-w-0 max-w-full"
    :style="expanded ? { width: `${anchorRect.width}px` } : undefined"
  >
    <span
      ref="anchorRef"
      class="relative z-20 inline-flex h-[22px] w-auto max-w-full min-w-0 items-center gap-1 overflow-hidden rounded-md px-2 text-[12px] font-medium transition-[color,background-color,border-color,box-shadow] duration-150 ease-out select-none"
      :class="[expanded ? 'opacity-0' : muted ? 'opacity-45' : '']"
      :style="chipStyle"
      @mouseenter="onChipEnter"
      @mouseleave="onChipLeave"
    >
      <Check v-if="isCurrent" :size="12" class="shrink-0" />
      <TagIcon v-if="showTagIcon" :size="12" class="shrink-0 opacity-90" />
      <span
        ref="labelRef"
        class="min-w-0 flex-1 truncate"
        :class="isCurrent ? 'font-semibold' : 'font-medium'"
      >
        {{ label }}
      </span>
      <span v-if="showLocalIcon || showRemoteIcon" class="ml-auto flex shrink-0 items-center gap-1">
        <TreePine
          v-if="showLocalIcon && worktree"
          :size="12"
          class="opacity-90"
          :aria-label="`Checked out in worktree ${worktree.path}`"
        />
        <Monitor v-else-if="showLocalIcon" :size="12" class="opacity-90" />
        <Cloud v-if="showRemoteIcon" :size="12" class="opacity-90" />
      </span>
    </span>
  </span>

  <Teleport to="body">
    <span
      v-if="expanded"
      class="pointer-events-none fixed z-40 inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 text-[12px] font-medium drop-shadow-md transition-[color,background-color,border-color,box-shadow] duration-150 ease-out select-none"
      :style="{
        ...chipStyle,
        top: `${anchorRect.top}px`,
        left: `${anchorRect.left}px`,
        height: `${anchorRect.height}px`,
      }"
    >
      <Check v-if="isCurrent" :size="12" class="shrink-0" />
      <TagIcon v-if="showTagIcon" :size="12" class="shrink-0 opacity-90" />
      <span :class="isCurrent ? 'font-semibold' : 'font-medium'">{{ label }}</span>
      <span v-if="showLocalIcon || showRemoteIcon" class="ml-auto flex shrink-0 items-center gap-1">
        <TreePine
          v-if="showLocalIcon && worktree"
          :size="12"
          class="opacity-90"
          :aria-label="`Checked out in worktree ${worktree.path}`"
        />
        <Monitor v-else-if="showLocalIcon" :size="12" class="opacity-90" />
        <Cloud v-if="showRemoteIcon" :size="12" class="opacity-90" />
      </span>
    </span>
  </Teleport>
</template>
