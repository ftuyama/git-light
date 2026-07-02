<script setup lang="ts">
import { computed, onMounted, toRef } from 'vue'
import { useMemoize } from '@vueuse/core'
import type { DiffResult } from '@shared/git/models'
import { useDiffStaging } from '@/composables/useDiffStaging'
import { buildUnifiedLines } from '@/lib/diff/buildUnifiedLines'
import { pairedLineIndices } from '@/lib/diff/pairedLineIndices'
import { lineClass } from '@/lib/diff/diffLineStyles'
import { highlightLine } from '@/lib/diff/highlight'
import { useDiffLineVirtualizer } from './composables/useDiffLineVirtualizer'
import DiffStageButton from './DiffStageButton.vue'
import DiffDiscardButton from './DiffDiscardButton.vue'

const props = defineProps<{
  diff: DiffResult
}>()

const lines = computed(() => buildUnifiedLines(props.diff.hunks))
const lineCount = computed(() => lines.value.length)
const diffVirtualizer = useDiffLineVirtualizer(lineCount)
const { virtualItems, totalSize, scrollEl } = diffVirtualizer
onMounted(() => void scrollEl.value)
const diffRef = toRef(props, 'diff')
const { canStage, canPartialStage, canDiscard, stageHunk, unstageHunk, discardHunk, stageLines, unstageLines } =
  useDiffStaging(diffRef)

const highlight = useMemoize((content: string, language: string) =>
  highlightLine(content, language),
)

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
    <div class="relative w-full" :style="{ height: `${totalSize}px` }">
      <div
        v-for="item in virtualItems"
        :key="lines[item.index].key"
        class="diff-row group/diff-row absolute right-0 left-0 flex font-mono text-[11px] leading-5"
        :class="lineClass(lines[item.index].type)"
        :style="{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }"
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
          class="diff-code min-w-0 flex-1 whitespace-pre-wrap break-all px-1"
        >{{ lines[item.index].content }}</code>
        <code
          v-else
          class="diff-code hljs min-w-0 flex-1 whitespace-pre-wrap break-all px-1"
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
