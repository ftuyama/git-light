<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useMemoize } from '@vueuse/core'
import type { DiffResult } from '@shared/git/models'
import { useDiffStaging } from '@/composables/useDiffStaging'
import { buildUnifiedLines } from '@/lib/diff/buildUnifiedLines'
import { lineClass } from '@/lib/diff/diffLineStyles'
import { highlightLine } from '@/lib/diff/highlight'
import DiffStageButton from './DiffStageButton.vue'

const props = defineProps<{
  diff: DiffResult
}>()

const lines = computed(() => buildUnifiedLines(props.diff.hunks))
const diffRef = toRef(props, 'diff')
const { canStage, canPartialStage, stageHunk, unstageHunk, stageLines, unstageLines } =
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

function onLineAction(hunkIndex: number, lineIndex: number): void {
  void (canStage.value ? stageLines(hunkIndex, [lineIndex]) : unstageLines(hunkIndex, [lineIndex]))
}
</script>

<template>
  <div class="diff-view min-h-0 flex-1 overflow-auto select-text">
    <div
      v-for="line in lines"
      :key="line.key"
      class="diff-row group/diff-row flex font-mono text-[11px] leading-5"
      :class="lineClass(line.type)"
    >
      <span
        class="diff-gutter w-10 shrink-0 pr-2 text-right tabular-nums select-none"
        :class="gutterClass(line.type)"
      >{{ line.oldLine ?? '' }}</span>
      <span
        class="diff-gutter w-10 shrink-0 pr-2 text-right tabular-nums select-none"
        :class="gutterClass(line.type)"
      >{{ line.newLine ?? '' }}</span>
      <span class="diff-prefix w-4 shrink-0 select-none opacity-70">{{ prefix(line.type) }}</span>
      <code
        v-if="line.type === 'hunk'"
        class="diff-code min-w-0 flex-1 whitespace-pre-wrap break-all px-1"
      >{{ line.content }}</code>
      <code
        v-else
        class="diff-code hljs min-w-0 flex-1 whitespace-pre-wrap break-all px-1"
        v-html="highlight(line.content, diff.language)"
      />
      <DiffStageButton
        v-if="line.type === 'hunk' && canPartialStage"
        :mode="canStage ? 'stage' : 'unstage'"
        scope="hunk"
        @action="onHunkAction(line.hunkIndex)"
      />
      <DiffStageButton
        v-else-if="(line.type === 'add' || line.type === 'del') && line.lineIndex != null && canPartialStage"
        :mode="canStage ? 'stage' : 'unstage'"
        scope="line"
        @action="onLineAction(line.hunkIndex, line.lineIndex)"
      />
    </div>
  </div>
</template>
