<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { BlameResult } from '@shared/git/models'
import { guessLanguage } from '@shared/diff/guessLanguage'
import { fullTimestamp, relativeTime } from '@/lib/format'
import { highlightBlameLines } from '@/lib/diff/highlight'
import {
  blockForLineIndex,
  buildBlameBlocks,
  isBlockStart,
  type BlameBlock,
} from '@/lib/diff/buildBlameBlocks'
import {
  DIFF_ROW_HEIGHT,
  estimateWrappedRowHeight,
} from '@/lib/diff/estimateWrappedRowHeight'
import { resolveAuthor } from '@/lib/resolveAuthor'
import { laneColor } from '@/lib/utils'
import { useUiStore } from '@/stores/ui'
import Avatar from '@/components/ui/Avatar.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import { useDiffLineVirtualizer } from './composables/useDiffLineVirtualizer'
import type { Author } from '@/types/git'

const BLAME_GUTTER_WIDTH = 368

const props = defineProps<{
  blame: BlameResult
}>()

const ui = useUiStore()
const codeColumnWidth = ref(400)

const blocks = computed(() => buildBlameBlocks(props.blame.lines))
const lineCount = computed(() => props.blame.lines.length)
const wordWrap = computed(() => ui.blameWordWrap)

const rowHeightForIndex = computed(() => {
  if (!wordWrap.value) return undefined
  const width = codeColumnWidth.value
  return (index: number) => {
    const content = props.blame.lines[index]?.content ?? ''
    return estimateWrappedRowHeight(content, width)
  }
})

const getRowHeightRef = computed(() => rowHeightForIndex.value)

const diffVirtualizer = useDiffLineVirtualizer(lineCount, { getRowHeight: getRowHeightRef })
const { virtualItems, totalSize, scrollEl } = diffVirtualizer

const language = computed(() => props.blame.language || guessLanguage(props.blame.path))

const highlightedLines = computed(() =>
  highlightBlameLines(
    props.blame.lines.map((line) => line.content),
    language.value,
  ),
)

const authorsByBlockKey = computed(() => {
  const map = new Map<string, Author>()
  for (const block of blocks.value) {
    const key = block.authorEmail.toLowerCase() || block.author.toLowerCase()
    if (!map.has(key)) {
      map.set(key, resolveAuthor(block.author, block.authorEmail))
    }
  }
  return map
})

let resizeObserver: ResizeObserver | undefined

function updateCodeColumnWidth(): void {
  const el = scrollEl.value
  if (!el) return
  codeColumnWidth.value = Math.max(1, el.clientWidth - BLAME_GUTTER_WIDTH)
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

function authorForBlock(block: BlameBlock): Author {
  const key = block.authorEmail.toLowerCase() || block.author.toLowerCase()
  return authorsByBlockKey.value.get(key) ?? resolveAuthor(block.author, block.authorEmail)
}

function authorTooltip(block: BlameBlock): string {
  if (block.authorEmail) return `${block.author} <${block.authorEmail}>`
  return block.author
}

function commitDate(epoch: number): string {
  return relativeTime(new Date(epoch * 1000))
}

function commitDateTooltip(epoch: number): string {
  return fullTimestamp(new Date(epoch * 1000))
}

function commitMessage(block: BlameBlock): string {
  return block.summary?.trim() || block.shortSha
}

function blockAt(index: number): BlameBlock | undefined {
  return blockForLineIndex(blocks.value, index)
}

function rowHeight(index: number): number {
  return rowHeightForIndex.value?.(index) ?? DIFF_ROW_HEIGHT
}

function blockHeight(block: BlameBlock): string {
  if (!wordWrap.value) {
    return `${block.lineCount * DIFF_ROW_HEIGHT}px`
  }
  let height = 0
  for (let i = block.startLineIndex; i < block.startLineIndex + block.lineCount; i++) {
    height += rowHeight(i)
  }
  return `${height}px`
}

function showBlockMeta(index: number): boolean {
  const block = blockAt(index)
  return Boolean(block && isBlockStart(block, index))
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
        :key="item.index"
        class="absolute left-0 flex font-mono text-[11px] leading-5"
        :class="wordWrap ? 'right-0' : 'min-w-full'"
        :style="{
          height: `${rowHeight(item.index)}px`,
          transform: `translateY(${item.start}px)`,
        }"
      >
        <template v-if="blame.lines[item.index] && blockAt(item.index)">
          <div
            class="sticky left-0 z-10 flex shrink-0 bg-[var(--color-app)]"
            :style="{ height: `${rowHeight(item.index)}px` }"
          >
            <div
              class="relative w-6 shrink-0"
              :style="{ height: `${rowHeight(item.index)}px` }"
            >
              <div
                v-if="showBlockMeta(item.index)"
                class="absolute top-0 left-0 flex w-full items-center justify-center"
                :style="{ height: blockHeight(blockAt(item.index)!) }"
              >
                <Tooltip :label="authorTooltip(blockAt(item.index)!)" side="right">
                  <Avatar :author="authorForBlock(blockAt(item.index)!)" :size="16" />
                </Tooltip>
              </div>
            </div>
            <span class="w-10 shrink-0 pr-2 text-right text-[var(--color-fg-subtle)] tabular-nums">
              {{ blame.lines[item.index].lineNumber }}
            </span>
            <div
              class="relative w-48 shrink-0 pr-2"
              :style="{ height: `${rowHeight(item.index)}px` }"
            >
              <div
                v-if="showBlockMeta(item.index)"
                class="absolute top-0 left-0 flex w-full items-center overflow-hidden"
                :style="{ height: blockHeight(blockAt(item.index)!) }"
              >
                <span
                  class="truncate text-[var(--color-fg-muted)]"
                  :title="commitMessage(blockAt(item.index)!)"
                >
                  {{ commitMessage(blockAt(item.index)!) }}
                </span>
              </div>
            </div>
            <div
              class="relative w-24 shrink-0 pr-2"
              :style="{ height: `${rowHeight(item.index)}px` }"
            >
              <div
                v-if="showBlockMeta(item.index)"
                class="absolute top-0 left-0 flex w-full items-center overflow-hidden"
                :style="{ height: blockHeight(blockAt(item.index)!) }"
              >
                <span
                  class="truncate text-[var(--color-fg-subtle)]"
                  :title="commitDateTooltip(blockAt(item.index)!.authorTime)"
                >
                  {{ commitDate(blockAt(item.index)!.authorTime) }}
                </span>
              </div>
            </div>
            <div
              class="mx-1 w-1 shrink-0 self-stretch rounded-sm"
              :style="{ backgroundColor: laneColor(blockAt(item.index)!.colorIndex) }"
            />
          </div>
          <code
            class="diff-code hljs px-1"
            :class="
              wordWrap
                ? 'min-w-0 flex-1 whitespace-pre-wrap break-all'
                : 'whitespace-pre'
            "
            v-html="highlightedLines[item.index]"
          />
        </template>
      </div>
    </div>
  </div>
</template>
