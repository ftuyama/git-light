<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { useMemoize } from '@vueuse/core'
import type { DiffResult } from '@shared/git/models'
import { useDiffStaging } from '@/composables/useDiffStaging'
import { buildSplitRows, type SplitHunkRow, type SplitLineRow } from '@/lib/diff/buildSplitRows'
import { collectSplitLineIndices } from '@/lib/diff/pairedLineIndices'
import { lineBgClass, lineTextClass } from '@/lib/diff/diffLineStyles'
import { highlightLine } from '@/lib/diff/highlight'
import { useDiffLineVirtualizer } from './composables/useDiffLineVirtualizer'
import DiffStageButton from './DiffStageButton.vue'
import DiffDiscardButton from './DiffDiscardButton.vue'

const props = defineProps<{
  diff: DiffResult
}>()

const rows = computed(() => buildSplitRows(props.diff.hunks))
const rowCount = computed(() => rows.value.length)
const { scrollEl: leftPane, virtualItems, totalSize } = useDiffLineVirtualizer(rowCount)
const rightPane = ref<HTMLElement | null>(null)
let syncing = false

const diffRef = toRef(props, 'diff')
const { canStage, canPartialStage, canDiscard, stageHunk, unstageHunk, discardHunk, stageLines, unstageLines } =
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

function onDiscardHunk(hunkIndex: number): void {
  void discardHunk(hunkIndex)
}

function onLineAction(hunkIndex: number, leftLineIndex?: number, rightLineIndex?: number): void {
  const indices = collectSplitLineIndices(leftLineIndex, rightLineIndex)
  if (indices.length === 0) return
  void (canStage.value ? stageLines(hunkIndex, indices) : unstageLines(hunkIndex, indices))
}

function hunkAt(index: number): SplitHunkRow | null {
  const row = rows.value[index]
  return row?.kind === 'hunk' ? row : null
}

function lineAt(index: number): SplitLineRow | null {
  const row = rows.value[index]
  return row?.kind === 'line' ? row : null
}

function isStageableLineRow(row: SplitLineRow): boolean {
  return row.left.type === 'del' || row.right.type === 'add'
}

function showLineButtonOnLeft(row: SplitLineRow): boolean {
  return canPartialStage.value && isStageableLineRow(row) && row.left.type === 'del' && row.right.type === 'empty'
}

function showLineButtonOnRight(row: SplitLineRow): boolean {
  return canPartialStage.value && isStageableLineRow(row) && row.right.type === 'add'
}
</script>

<template>
  <div class="diff-view grid min-h-0 flex-1 grid-cols-2 overflow-hidden select-text">
    <div
      ref="leftPane"
      class="min-h-0 overflow-auto border-r border-[var(--color-border)]"
      @scroll="onLeftScroll"
    >
      <div class="relative w-full" :style="{ height: `${totalSize}px` }">
        <template v-for="item in virtualItems" :key="`left-${rows[item.index].key}`">
          <div
            v-if="hunkAt(item.index)"
            class="diff-row group/diff-row absolute right-0 left-0 flex items-center bg-[var(--color-info)]/10 px-2 font-mono text-[11px] leading-5 font-medium text-[var(--color-info)]"
            :style="{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }"
          >
            <span class="min-w-0 flex-1 whitespace-pre-wrap break-all py-px">{{ hunkAt(item.index)!.header }}</span>
            <div
              v-if="canPartialStage || canDiscard"
              class="flex shrink-0 items-center gap-1"
            >
              <DiffDiscardButton
                v-if="canDiscard"
                scope="hunk"
                @action="onDiscardHunk(hunkAt(item.index)!.hunkIndex)"
              />
              <DiffStageButton
                v-if="canPartialStage"
                :mode="canStage ? 'stage' : 'unstage'"
                scope="hunk"
                @action="onHunkAction(hunkAt(item.index)!.hunkIndex)"
              />
            </div>
          </div>
          <div
            v-else-if="lineAt(item.index)"
            class="diff-row group/diff-row absolute right-0 left-0 flex font-mono text-[11px] leading-5"
            :class="sideClass(lineAt(item.index)!.left.type)"
            :style="{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }"
          >
            <span class="diff-gutter w-10 shrink-0 pr-2 text-right tabular-nums text-[var(--color-fg-subtle)] select-none">
              {{ lineAt(item.index)!.left.lineNum ?? '' }}
            </span>
            <code
              v-if="lineAt(item.index)!.left.type === 'empty'"
              class="diff-code min-w-0 flex-1 px-1"
            >&nbsp;</code>
            <code
              v-else
              class="diff-code hljs min-w-0 flex-1 whitespace-pre-wrap break-all px-1"
              v-html="highlight(lineAt(item.index)!.left.content, diff.language)"
            />
            <DiffStageButton
              v-if="showLineButtonOnLeft(lineAt(item.index)!)"
              :mode="canStage ? 'stage' : 'unstage'"
              scope="line"
              @action="onLineAction(
                lineAt(item.index)!.hunkIndex,
                lineAt(item.index)!.leftLineIndex,
                lineAt(item.index)!.rightLineIndex,
              )"
            />
          </div>
        </template>
      </div>
    </div>

    <div
      ref="rightPane"
      class="min-h-0 overflow-auto"
      @scroll="onRightScroll"
    >
      <div class="relative w-full" :style="{ height: `${totalSize}px` }">
        <template v-for="item in virtualItems" :key="`right-${rows[item.index].key}`">
          <div
            v-if="hunkAt(item.index)"
            class="diff-row group/diff-row absolute right-0 left-0 flex items-center bg-[var(--color-info)]/10 px-2 font-mono text-[11px] leading-5 font-medium text-[var(--color-info)]"
            :style="{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }"
          >
            <span class="min-w-0 flex-1 whitespace-pre-wrap break-all py-px">{{ hunkAt(item.index)!.header }}</span>
            <div
              v-if="canPartialStage || canDiscard"
              class="flex shrink-0 items-center gap-1"
            >
              <DiffDiscardButton
                v-if="canDiscard"
                scope="hunk"
                @action="onDiscardHunk(hunkAt(item.index)!.hunkIndex)"
              />
              <DiffStageButton
                v-if="canPartialStage"
                :mode="canStage ? 'stage' : 'unstage'"
                scope="hunk"
                @action="onHunkAction(hunkAt(item.index)!.hunkIndex)"
              />
            </div>
          </div>
          <div
            v-else-if="lineAt(item.index)"
            class="diff-row group/diff-row absolute right-0 left-0 flex font-mono text-[11px] leading-5"
            :class="sideClass(lineAt(item.index)!.right.type)"
            :style="{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }"
          >
            <span class="diff-gutter w-10 shrink-0 pr-2 text-right tabular-nums text-[var(--color-fg-subtle)] select-none">
              {{ lineAt(item.index)!.right.lineNum ?? '' }}
            </span>
            <code
              v-if="lineAt(item.index)!.right.type === 'empty'"
              class="diff-code min-w-0 flex-1 px-1"
            >&nbsp;</code>
            <code
              v-else
              class="diff-code hljs min-w-0 flex-1 whitespace-pre-wrap break-all px-1"
              v-html="highlight(lineAt(item.index)!.right.content, diff.language)"
            />
            <DiffStageButton
              v-if="showLineButtonOnRight(lineAt(item.index)!)"
              :mode="canStage ? 'stage' : 'unstage'"
              scope="line"
              @action="onLineAction(
                lineAt(item.index)!.hunkIndex,
                lineAt(item.index)!.leftLineIndex,
                lineAt(item.index)!.rightLineIndex,
              )"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
