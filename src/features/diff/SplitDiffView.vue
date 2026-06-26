<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { useMemoize } from '@vueuse/core'
import type { DiffResult } from '@shared/git/models'
import { useDiffStaging } from '@/composables/useDiffStaging'
import { buildSplitRows } from '@/lib/diff/buildSplitRows'
import { lineBgClass, lineTextClass } from '@/lib/diff/diffLineStyles'
import { highlightLine } from '@/lib/diff/highlight'
import DiffStageButton from './DiffStageButton.vue'

const props = defineProps<{
  diff: DiffResult
}>()

const rows = computed(() => buildSplitRows(props.diff.hunks))
const leftPane = ref<HTMLElement | null>(null)
const rightPane = ref<HTMLElement | null>(null)
let syncing = false

const diffRef = toRef(props, 'diff')
const { canStage, canPartialStage, stageHunk, unstageHunk, stageLines, unstageLines } =
  useDiffStaging(diffRef)

const highlight = useMemoize((content: string, language: string) =>
  highlightLine(content, language),
)

function sideClass(type: 'context' | 'add' | 'del' | 'empty'): string {
  return [lineBgClass(type), lineTextClass(type)].filter(Boolean).join(' ')
}

function syncScroll(source: HTMLElement, target: HTMLElement | null): void {
  if (!target || syncing) return
  syncing = true
  target.scrollTop = source.scrollTop
  requestAnimationFrame(() => {
    syncing = false
  })
}

function onLeftScroll(event: Event): void {
  syncScroll(event.target as HTMLElement, rightPane.value)
}

function onRightScroll(event: Event): void {
  syncScroll(event.target as HTMLElement, leftPane.value)
}

function onHunkAction(hunkIndex: number): void {
  void (canStage.value ? stageHunk(hunkIndex) : unstageHunk(hunkIndex))
}

function onLineAction(hunkIndex: number, lineIndex: number): void {
  void (canStage.value ? stageLines(hunkIndex, [lineIndex]) : unstageLines(hunkIndex, [lineIndex]))
}
</script>

<template>
  <div class="diff-view grid min-h-0 flex-1 grid-cols-2 overflow-hidden select-text">
    <div
      ref="leftPane"
      class="min-h-0 overflow-auto border-r border-[var(--color-border)]"
      @scroll="onLeftScroll"
    >
      <template v-for="row in rows" :key="`left-${row.key}`">
        <div
          v-if="row.kind === 'hunk'"
          class="diff-row group/diff-row flex items-center bg-[var(--color-info)]/10 px-2 font-mono text-[11px] leading-5 font-medium text-[var(--color-info)]"
        >
          <span class="min-w-0 flex-1 whitespace-pre-wrap break-all py-px">{{ row.header }}</span>
          <DiffStageButton
            v-if="canPartialStage"
            :mode="canStage ? 'stage' : 'unstage'"
            scope="hunk"
            @action="onHunkAction(row.hunkIndex)"
          />
        </div>
        <div
          v-else
          class="diff-row group/diff-row flex font-mono text-[11px] leading-5"
          :class="sideClass(row.left.type)"
        >
          <span class="diff-gutter w-10 shrink-0 pr-2 text-right tabular-nums text-[var(--color-fg-subtle)] select-none">
            {{ row.left.lineNum ?? '' }}
          </span>
          <code
            v-if="row.left.type === 'empty'"
            class="diff-code min-w-0 flex-1 px-1"
          >&nbsp;</code>
          <code
            v-else
            class="diff-code hljs min-w-0 flex-1 whitespace-pre-wrap break-all px-1"
            v-html="highlight(row.left.content, diff.language)"
          />
          <DiffStageButton
            v-if="row.left.type === 'del' && row.leftLineIndex != null && canPartialStage"
            :mode="canStage ? 'stage' : 'unstage'"
            scope="line"
            @action="onLineAction(row.hunkIndex, row.leftLineIndex)"
          />
        </div>
      </template>
    </div>

    <div
      ref="rightPane"
      class="min-h-0 overflow-auto"
      @scroll="onRightScroll"
    >
      <template v-for="row in rows" :key="`right-${row.key}`">
        <div
          v-if="row.kind === 'hunk'"
          class="diff-row flex bg-[var(--color-info)]/10 px-2 font-mono text-[11px] leading-5 font-medium text-[var(--color-info)]"
        >
          <span class="whitespace-pre-wrap break-all py-px">{{ row.header }}</span>
        </div>
        <div
          v-else
          class="diff-row group/diff-row flex font-mono text-[11px] leading-5"
          :class="sideClass(row.right.type)"
        >
          <span class="diff-gutter w-10 shrink-0 pr-2 text-right tabular-nums text-[var(--color-fg-subtle)] select-none">
            {{ row.right.lineNum ?? '' }}
          </span>
          <code
            v-if="row.right.type === 'empty'"
            class="diff-code min-w-0 flex-1 px-1"
          >&nbsp;</code>
          <code
            v-else
            class="diff-code hljs min-w-0 flex-1 whitespace-pre-wrap break-all px-1"
            v-html="highlight(row.right.content, diff.language)"
          />
          <DiffStageButton
            v-if="row.right.type === 'add' && row.rightLineIndex != null && canPartialStage"
            :mode="canStage ? 'stage' : 'unstage'"
            scope="line"
            @action="onLineAction(row.hunkIndex, row.rightLineIndex)"
          />
        </div>
      </template>
    </div>
  </div>
</template>
