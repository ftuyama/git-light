<script setup lang="ts">
import { computed, onUnmounted, ref, useTemplateRef } from 'vue'
import { Check, Cloud, Monitor } from '@lucide/vue'
import { formatRefLabel } from '@shared/git/refLabel'
import type { Ref } from '@/types/git'

const props = defineProps<{
  refData: Ref
  color: string
  /** When set, overrides type-based local icon visibility (e.g. merged local+remote). */
  hasLocal?: boolean
  /** When set, overrides type-based remote icon visibility (e.g. merged local+remote). */
  hasRemote?: boolean
}>()

const label = computed(() =>
  props.refData.label
    ? props.refData.label
    : formatRefLabel(props.refData.name, props.refData.type),
)

const isCurrent = computed(() => props.refData.isHead === true)
const showLocalIcon = computed(
  () => props.hasLocal ?? props.refData.type === 'localBranch',
)
const showRemoteIcon = computed(
  () => props.hasRemote ?? props.refData.type === 'remoteBranch',
)

const resolvedColor = computed((): string => {
  if (isCurrent.value) return 'var(--color-accent)'
  return props.refData.type === 'tag' ? 'var(--color-warning)' : props.color
})

const chipStyle = computed(() => {
  const mix = isCurrent.value ? 44 : 38
  const borderMix = isCurrent.value ? 78 : 72
  const textColor = isCurrent.value
    ? 'var(--color-fg)'
    : `color-mix(in srgb, ${resolvedColor.value} 50%, var(--color-fg))`
  return {
    color: textColor,
    backgroundColor: `color-mix(in srgb, ${resolvedColor.value} ${mix}%, var(--color-panel-raised))`,
    border: `1px solid color-mix(in srgb, ${resolvedColor.value} ${borderMix}%, var(--color-border-strong))`,
  }
})

const anchorRef = useTemplateRef('anchorRef')
const labelRef = useTemplateRef('labelRef')
const expanded = ref(false)
const anchorRect = ref({ top: 0, left: 0, width: 0, height: 18 })

let leaveTimer: ReturnType<typeof setTimeout> | undefined

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
    class="block h-[18px] min-w-0 max-w-full"
    :style="expanded ? { width: `${anchorRect.width}px` } : undefined"
  >
    <span
      ref="anchorRef"
      class="relative z-20 inline-flex h-[18px] w-full max-w-full min-w-0 items-center gap-0.5 overflow-hidden rounded px-1.5 text-[11px] font-medium"
      :class="expanded ? 'invisible' : ''"
      :style="chipStyle"
      @mouseenter="expand"
    >
      <Check v-if="isCurrent" :size="10" class="shrink-0" />
      <span
        ref="labelRef"
        class="min-w-0 flex-1 truncate"
        :class="isCurrent ? 'font-semibold' : 'font-medium'"
      >
        {{ label }}
      </span>
      <span v-if="showLocalIcon || showRemoteIcon" class="ml-auto flex shrink-0 items-center gap-0.5">
        <Monitor v-if="showLocalIcon" :size="10" class="opacity-90" />
        <Cloud v-if="showRemoteIcon" :size="10" class="opacity-90" />
      </span>
    </span>
  </span>

  <Teleport to="body">
    <span
      v-if="expanded"
      class="fixed z-[100] inline-flex items-center gap-0.5 whitespace-nowrap rounded px-1.5 text-[11px] font-medium shadow-md"
      :style="{
        ...chipStyle,
        top: `${anchorRect.top}px`,
        left: `${anchorRect.left}px`,
        height: `${anchorRect.height}px`,
      }"
      @mouseenter="cancelCollapse"
      @mouseleave="scheduleCollapse"
    >
      <Check v-if="isCurrent" :size="10" class="shrink-0" />
      <span :class="isCurrent ? 'font-semibold' : 'font-medium'">{{ label }}</span>
      <span v-if="showLocalIcon || showRemoteIcon" class="ml-auto flex shrink-0 items-center gap-0.5">
        <Monitor v-if="showLocalIcon" :size="10" class="opacity-90" />
        <Cloud v-if="showRemoteIcon" :size="10" class="opacity-90" />
      </span>
    </span>
  </Teleport>
</template>
