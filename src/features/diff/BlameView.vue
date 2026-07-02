<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { BlameResult } from '@shared/git/models'
import { relativeTime } from '@/lib/format'
import { useDiffLineVirtualizer } from './composables/useDiffLineVirtualizer'

const props = defineProps<{
  blame: BlameResult
}>()

const lineCount = computed(() => props.blame.lines.length)
const diffVirtualizer = useDiffLineVirtualizer(lineCount)
const { virtualItems, totalSize, scrollEl } = diffVirtualizer
onMounted(() => void scrollEl.value)

function authorTime(epoch: number): string {
  return relativeTime(new Date(epoch * 1000))
}
</script>

<template>
  <div ref="scrollEl" class="diff-view min-h-0 flex-1 overflow-auto select-text">
    <div class="relative w-full" :style="{ height: `${totalSize}px` }">
      <div
        v-for="item in virtualItems"
        :key="item.index"
        class="absolute right-0 left-0 flex font-mono text-[11px] leading-5"
        :style="{ transform: `translateY(${item.start}px)` }"
      >
        <template v-if="blame.lines[item.index]">
          <span class="w-10 shrink-0 pr-2 text-right text-[var(--color-fg-subtle)] tabular-nums">
            {{ blame.lines[item.index].lineNumber }}
          </span>
          <span
            class="w-16 shrink-0 truncate pr-2 text-[var(--color-accent)]"
            :title="blame.lines[item.index].commitSha"
          >
            {{ blame.lines[item.index].shortSha }}
          </span>
          <span
            class="w-28 shrink-0 truncate pr-2 text-[var(--color-fg-muted)]"
            :title="blame.lines[item.index].author"
          >
            {{ blame.lines[item.index].author }}
          </span>
          <span class="w-20 shrink-0 pr-2 text-[var(--color-fg-subtle)]">
            {{ authorTime(blame.lines[item.index].authorTime) }}
          </span>
          <span class="min-w-0 flex-1 truncate whitespace-pre text-[var(--color-fg)]">
            {{ blame.lines[item.index].content }}
          </span>
        </template>
      </div>
    </div>
  </div>
</template>
