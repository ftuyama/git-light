<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import { useMemoize } from '@vueuse/core'
import type { DiffResult } from '@shared/git/models'
import { useDiffStaging } from '@/composables/useDiffStaging'
import { buildUnifiedLines } from '@/lib/diff/buildUnifiedLines'
import { pairedLineIndices } from '@/lib/diff/pairedLineIndices'
import { lineClass } from '@/lib/diff/diffLineStyles'
import { highlightLine } from '@/lib/diff/highlight'
import {
  DIFF_ROW_HEIGHT,
  estimateWrappedRowHeight,
} from '@/lib/diff/estimateWrappedRowHeight'
import { useUiStore } from '@/stores/ui'
import { useDiffLineVirtualizer } from './composables/useDiffLineVirtualizer'
import DiffStageButton from './DiffStageButton.vue'
import DiffDiscardButton from './DiffDiscardButton.vue'

const props = defineProps<{
  diff: DiffResult
}>()

const ui = useUiStore()
const wordWrap = computed(() => ui.diffWordWrap)
const codeColumnWidth = ref(400)

const lines = computed(() => buildUnifiedLines(props.diff.hunks))
const lineCount = computed(() => lines.value.length)

const rowHeightForIndex = computed(() => {
  if (!wordWrap.value) return undefined
  const width = codeColumnWidth.value
  return (index: number) => {
    const content = lines.value[index]?.content ?? ''
    return estimateWrappedRowHeight(content, width)
  }
})

const getRowHeightRef = computed(() => rowHeightForIndex.value)

const diffVirtualizer = useDiffLineVirtualizer(lineCount, { getRowHeight: getRowHeightRef })
const { virtualItems, totalSize, scrollEl } = diffVirtualizer
const diffRef = toRef(props, 'diff')
const { canStage, canPartialStage, canDiscard, stageHunk, unstageHunk, discardHunk, stageLines, unstageLines } =
  useDiffStaging(diffRef)

const highlight = useMemoize((content: string, language: string) =>
  highlightLine(content, language),
)

let resizeObserver: ResizeObserver | undefined

function updateCodeColumnWidth(): void {
  const el = scrollEl.value
  if (!el) return
  codeColumnWidth.value = Math.max(1, el.clientWidth - 112)
}

onMounted(() => {
  updateCodeColumnWidth()
  if (scrollEl.value) {
    resizeObserver = new ResizeObserver(() => updateCodeColumnWidth())
    resizeObserver.observe(scrollEl.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

watch(wordWrap, () => updateCodeColumnWidth())

watch([wordWrap, codeColumnWidth], () => {
  diffVirtualizer.virtualizer.value.measure()
})

function rowHeight(index: number): number {
  return rowHeightForIndex.value?.(index) ?? DIFF_ROW_HEIGHT
}

function gutterClass(type: string): string {
  if (type === 'hunk') return 'text-[var(--color-info)]'
  return 'text-[var(--color-fg-subtle)]'
}

function prefix(type: string): string {
  switch (type) {
    case 'add':
      return '+'
    case 'del':
      return '−'
    default:
      return ' '
  }
}

function onHunkAction(hunkIndex: number): void {
  void (canStage.value ? stageHunk(hunkIndex) : unstageHunk(hunkIndex))
}

function onDiscardHunk(hunkIndex: number): void {
  void discardHunk(hunkIndex)
}

function onLineAction(hunkIndex: number, lineIndex: number): void {
  const hunk = props.diff.hunks[hunkIndex]
  if (!hunk) return
  const indices = pairedLineIndices(hunk, lineIndex)
  void (canStage.value ? stageLines(hunkIndex, indices) : unstageLines(hunkIndex, indices))
}
</script>

<template>
  <div ref="scrollEl" class="diff-view min-h-0 flex-1 overflow-auto select-text">
    <div
      class="relative"
      :class="wordWrap ? 'w-full' : 'min-w-max'"
      :style="{ height: `${totalSize}px` }"
    >
      <div
        v-for="item in virtualItems"
        :key="lines[item.index].key"
        class="diff-row group/diff-row absolute left-0 flex font-mono text-[11px] leading-5"
        :class="[lineClass(lines[item.index].type), wordWrap ? 'right-0' : 'min-w-full']"
        :style="{ height: `${rowHeight(item.index)}px`, transform: `translateY(${item.start}px)` }"
      >
        <span
          class="diff-gutter w-10 shrink-0 pr-2 text-right tabular-nums select-none"
          :class="gutterClass(lines[item.index].type)"
        >{{ lines[item.index].oldLine ?? '' }}</span>
        <span
          class="diff-gutter w-10 shrink-0 pr-2 text-right tabular-nums select-none"
          :class="gutterClass(lines[item.index].type)"
        >{{ lines[item.index].newLine ?? '' }}</span>
        <span class="diff-prefix w-4 shrink-0 select-none opacity-70">{{ prefix(lines[item.index].type) }}</span>
        <code
          v-if="lines[item.index].type === 'hunk'"
          class="diff-code min-w-0 flex-1 px-1"
          :class="wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'"
        >{{ lines[item.index].content }}</code>
        <code
          v-else
          class="diff-code hljs min-w-0 flex-1 px-1"
          :class="wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'"
          v-html="highlight(lines[item.index].content, diff.language)"
        />
        <div
          v-if="lines[item.index].type === 'hunk' && (canPartialStage || canDiscard)"
          class="flex shrink-0 items-center gap-1"
        >
          <DiffDiscardButton
            v-if="canDiscard"
            scope="hunk"
            @action="onDiscardHunk(lines[item.index].hunkIndex)"
          />
          <DiffStageButton
            v-if="canPartialStage"
            :mode="canStage ? 'stage' : 'unstage'"
            scope="hunk"
            @action="onHunkAction(lines[item.index].hunkIndex)"
          />
        </div>
        <DiffStageButton
          v-else-if="(lines[item.index].type === 'add' || lines[item.index].type === 'del') && lines[item.index].lineIndex != null && canPartialStage"
          :mode="canStage ? 'stage' : 'unstage'"
          scope="line"
          @action="onLineAction(lines[item.index].hunkIndex, lines[item.index].lineIndex!)"
        />
      </div>
    </div>
  </div>
</template>
