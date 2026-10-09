<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import type { DiffResult } from '@shared/git/models'
import { useDiffStaging } from '@/composables/useDiffStaging'
import { buildSplitRows, type SplitHunkRow, type SplitLineRow } from '@/lib/diff/buildSplitRows'
import { collectSplitLineIndices } from '@/lib/diff/pairedLineIndices'
import { lineBgClass, lineTextClass } from '@/lib/diff/diffLineStyles'
import { highlightLine } from '@/lib/diff/highlight'
import { renderInlineDiff, shouldInlineHighlight } from '@/lib/diff/wordDiff'
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

const rows = computed(() => buildSplitRows(props.diff.hunks))
const rowCount = computed(() => rows.value.length)

const rowHeightForIndex = computed(() => {
  if (!wordWrap.value) return undefined
  const width = codeColumnWidth.value
  return (index: number) => {
    const row = rows.value[index]
    if (!row) return DIFF_ROW_HEIGHT
    if (row.kind === 'hunk') return estimateWrappedRowHeight(row.header, width)
    const left = row.left.type === 'empty' ? '' : row.left.content
    const right = row.right.type === 'empty' ? '' : row.right.content
    return Math.max(
      estimateWrappedRowHeight(left, width),
      estimateWrappedRowHeight(right, width),
    )
  }
})

const getRowHeightRef = computed(() => rowHeightForIndex.value)

const diffVirtualizer = useDiffLineVirtualizer(rowCount, { getRowHeight: getRowHeightRef })
const { scrollEl: leftPane, virtualItems, totalSize } = diffVirtualizer
const rightPane = ref<HTMLElement | null>(null)
let syncing = false

const diffRef = toRef(props, 'diff')
const { canStage, canPartialStage, canDiscard, stageHunk, unstageHunk, discardHunk, stageLines, unstageLines } =
  useDiffStaging(diffRef)

const splitInlineHtml = computed(() => {
  const map = new Map<string, { left: string | null; right: string | null }>()
  for (const row of rows.value) {
    if (row.kind !== 'line') continue
    if (row.left.type === 'del' && row.right.type === 'add') {
      if (!shouldInlineHighlight(row.left.content, row.right.content)) continue
      const { oldHtml, newHtml } = renderInlineDiff(
        row.left.content,
        row.right.content,
        props.diff.language,
      )
      map.set(row.key, { left: oldHtml, right: newHtml })
    }
  }
  return map
})

function cellHtml(
  rowKey: string,
  side: 'left' | 'right',
  type: string,
  content: string,
): string {
  if ((type === 'add' || type === 'del') && content) {
    const inline = splitInlineHtml.value.get(rowKey)?.[side]
    if (inline != null) return inline
  }
  return highlightLine(content, props.diff.language)
}

function sideClass(type: 'context' | 'add' | 'del' | 'empty'): string {
  return [lineBgClass(type), lineTextClass(type)].filter(Boolean).join(' ')
}

function gutterTextClass(type: string): string {
  if (type === 'add') return 'text-[var(--color-success)]'
  if (type === 'del') return 'text-[var(--color-danger)]'
  return 'text-[var(--color-fg-subtle)]'
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

let resizeObserver: ResizeObserver | undefined

function updateCodeColumnWidth(): void {
  const el = leftPane.value ?? rightPane.value
  if (!el) return
  codeColumnWidth.value = Math.max(1, el.clientWidth - 60)
}

onMounted(() => {
  updateCodeColumnWidth()
  if (leftPane.value) {
    resizeObserver = new ResizeObserver(() => updateCodeColumnWidth())
    resizeObserver.observe(leftPane.value)
  }
  if (rightPane.value) {
    resizeObserver ??= new ResizeObserver(() => updateCodeColumnWidth())
    resizeObserver.observe(rightPane.value)
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
      <div
        class="relative"
        :class="wordWrap ? 'w-full' : 'min-w-max'"
        :style="{ height: `${totalSize}px` }"
      >
        <template v-for="item in virtualItems" :key="`left-${rows[item.index].key}`">
          <div
            v-if="hunkAt(item.index)"
            class="diff-row group/diff-row absolute left-0 flex items-center bg-[var(--color-info)]/10 px-2 font-mono text-[11px] leading-5 font-medium text-[var(--color-info)]"
            :class="wordWrap ? 'right-0' : 'min-w-full'"
            :style="{ height: `${rowHeight(item.index)}px`, transform: `translateY(${item.start}px)` }"
          >
            <span
              class="min-w-0 flex-1 py-px"
              :class="wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'"
            >{{ hunkAt(item.index)!.header }}</span>
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
            class="diff-row group/diff-row absolute left-0 flex font-mono text-[11px] leading-5"
            :class="[sideClass(lineAt(item.index)!.left.type), wordWrap ? 'right-0' : 'min-w-full']"
            :style="{ height: `${rowHeight(item.index)}px`, transform: `translateY(${item.start}px)` }"
          >
            <span
              class="diff-gutter w-10 shrink-0 pr-2 text-right tabular-nums select-none"
              :class="gutterTextClass(lineAt(item.index)!.left.type)"
            >
              {{ lineAt(item.index)!.left.lineNum ?? '' }}
            </span>
            <code
              v-if="lineAt(item.index)!.left.type === 'empty'"
              class="diff-code min-w-0 flex-1 px-1"
            >&nbsp;</code>
            <code
              v-else
              class="diff-code hljs min-w-0 flex-1 px-1"
              :class="wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'"
              v-html="cellHtml(lineAt(item.index)!.key, 'left', lineAt(item.index)!.left.type, lineAt(item.index)!.left.content)"
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
      <div
        class="relative"
        :class="wordWrap ? 'w-full' : 'min-w-max'"
        :style="{ height: `${totalSize}px` }"
      >
        <template v-for="item in virtualItems" :key="`right-${rows[item.index].key}`">
          <div
            v-if="hunkAt(item.index)"
            class="diff-row group/diff-row absolute left-0 flex items-center bg-[var(--color-info)]/10 px-2 font-mono text-[11px] leading-5 font-medium text-[var(--color-info)]"
            :class="wordWrap ? 'right-0' : 'min-w-full'"
            :style="{ height: `${rowHeight(item.index)}px`, transform: `translateY(${item.start}px)` }"
          >
            <span
              class="min-w-0 flex-1 py-px"
              :class="wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'"
            >{{ hunkAt(item.index)!.header }}</span>
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
            class="diff-row group/diff-row absolute left-0 flex font-mono text-[11px] leading-5"
            :class="[sideClass(lineAt(item.index)!.right.type), wordWrap ? 'right-0' : 'min-w-full']"
            :style="{ height: `${rowHeight(item.index)}px`, transform: `translateY(${item.start}px)` }"
          >
            <span
              class="diff-gutter w-10 shrink-0 pr-2 text-right tabular-nums select-none"
              :class="gutterTextClass(lineAt(item.index)!.right.type)"
            >
              {{ lineAt(item.index)!.right.lineNum ?? '' }}
            </span>
            <code
              v-if="lineAt(item.index)!.right.type === 'empty'"
              class="diff-code min-w-0 flex-1 px-1"
            >&nbsp;</code>
            <code
              v-else
              class="diff-code hljs min-w-0 flex-1 px-1"
              :class="wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'"
              v-html="cellHtml(lineAt(item.index)!.key, 'right', lineAt(item.index)!.right.type, lineAt(item.index)!.right.content)"
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
