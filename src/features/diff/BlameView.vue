<script setup lang="ts">
import { computed, onMounted } from 'vue'
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
import { resolveAuthor } from '@/lib/resolveAuthor'
import { laneColor } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import { DIFF_ROW_HEIGHT, useDiffLineVirtualizer } from './composables/useDiffLineVirtualizer'
import type { Author } from '@/types/git'

const props = defineProps<{
  blame: BlameResult
}>()

const blocks = computed(() => buildBlameBlocks(props.blame.lines))
const lineCount = computed(() => props.blame.lines.length)
const diffVirtualizer = useDiffLineVirtualizer(lineCount)
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

onMounted(() => void scrollEl.value)

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

function blockHeight(lineCount: number): string {
  return `${lineCount * DIFF_ROW_HEIGHT}px`
}

function showBlockMeta(index: number): boolean {
  const block = blockAt(index)
  return Boolean(block && isBlockStart(block, index))
}
</script>

<template>
  <div ref="scrollEl" class="diff-view min-h-0 flex-1 overflow-auto select-text">
    <div class="relative w-full" :style="{ height: `${totalSize}px` }">
      <div
        v-for="item in virtualItems"
        :key="item.index"
        class="absolute right-0 left-0 flex font-mono text-[11px] leading-5"
        :style="{ height: `${DIFF_ROW_HEIGHT}px`, transform: `translateY(${item.start}px)` }"
      >
        <template v-if="blame.lines[item.index] && blockAt(item.index)">
          <div
            class="relative w-6 shrink-0"
            :style="{ height: `${DIFF_ROW_HEIGHT}px` }"
          >
            <div
              v-if="showBlockMeta(item.index)"
              class="absolute top-0 left-0 flex w-full items-center justify-center"
              :style="{ height: blockHeight(blockAt(item.index)!.lineCount) }"
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
            :style="{ height: `${DIFF_ROW_HEIGHT}px` }"
          >
            <div
              v-if="showBlockMeta(item.index)"
              class="absolute top-0 left-0 flex w-full items-center overflow-hidden"
              :style="{ height: blockHeight(blockAt(item.index)!.lineCount) }"
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
            :style="{ height: `${DIFF_ROW_HEIGHT}px` }"
          >
            <div
              v-if="showBlockMeta(item.index)"
              class="absolute top-0 left-0 flex w-full items-center overflow-hidden"
              :style="{ height: blockHeight(blockAt(item.index)!.lineCount) }"
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
          <code
            class="diff-code hljs min-w-0 flex-1 whitespace-pre-wrap break-all px-1"
            v-html="highlightedLines[item.index]"
          />
        </template>
      </div>
    </div>
  </div>
</template>
