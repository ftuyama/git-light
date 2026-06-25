<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { storeToRefs } from 'pinia'
import CommitRow from './CommitRow.vue'
import { useRepositoryStore } from '@/stores/repository'
import { useSelectionStore } from '@/stores/selection'

const repo = useRepositoryStore()
const selection = useSelectionStore()
const { selectedSha } = storeToRefs(selection)

const BASE_ROW_HEIGHT = 30
const BASE_LANE_WIDTH = 16
const LANE_PAD = 14
const NODE_RADIUS = 4.5

const zoom = ref(1)
const rowHeight = computed(() => Math.round(BASE_ROW_HEIGHT * zoom.value))
const laneWidth = computed(() => Math.round(BASE_LANE_WIDTH * zoom.value))
const graphWidth = computed(
  () => LANE_PAD * 2 + Math.max(1, repo.layout.maxLanes) * laneWidth.value,
)

const scrollEl = ref<HTMLElement | null>(null)

const virtualizer = useVirtualizer(
  computed(() => ({
    count: repo.commits.length,
    getScrollElement: () => scrollEl.value,
    estimateSize: () => rowHeight.value,
    overscan: 14,
  })),
)

const virtualItems = computed(() => virtualizer.value.getVirtualItems())
const totalSize = computed(() => virtualizer.value.getTotalSize())

function laneX(lane: number): number {
  return LANE_PAD + lane * laneWidth.value + laneWidth.value / 2
}

interface VisibleEdge {
  key: string
  d: string
  color: string
}

const visibleEdges = computed<VisibleEdge[]>(() => {
  const items = virtualItems.value
  if (items.length === 0) return []
  const first = Math.max(0, items[0].index - 1)
  const last = Math.min(repo.layout.bands.length - 1, items[items.length - 1].index)
  const rh = rowHeight.value
  const edges: VisibleEdge[] = []
  for (let band = first; band <= last; band++) {
    const segments = repo.layout.bands[band]
    if (!segments) continue
    const y1 = band * rh + rh / 2
    const y2 = (band + 1) * rh + rh / 2
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const x1 = laneX(seg.fromLane)
      const x2 = laneX(seg.toLane)
      const mid = (y1 + y2) / 2
      const d =
        x1 === x2
          ? `M${x1} ${y1} L${x2} ${y2}`
          : `M${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`
      edges.push({ key: `${band}-${i}`, d, color: seg.color })
    }
  }
  return edges
})

interface VisibleNode {
  key: string
  cx: number
  cy: number
  color: string
  selected: boolean
  merge: boolean
}

const visibleNodes = computed<VisibleNode[]>(() => {
  const rh = rowHeight.value
  return virtualItems.value
    .map((item): VisibleNode | null => {
      const node = repo.layout.nodes[item.index]
      if (!node) return null
      return {
        key: node.sha,
        cx: laneX(node.lane),
        cy: item.index * rh + rh / 2,
        color: node.color,
        selected: node.sha === selectedSha.value,
        merge: repo.commits[item.index]?.isMerge ?? false,
      }
    })
    .filter((node): node is VisibleNode => node !== null)
})

function onWheel(event: WheelEvent): void {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  const next = zoom.value * (1 - event.deltaY * 0.0015)
  zoom.value = Math.min(1.6, Math.max(0.75, next))
}

watch(rowHeight, () => virtualizer.value.measure())

watch(selectedSha, (sha) => {
  if (!sha) return
  const index = repo.commits.findIndex((c) => c.sha === sha)
  if (index >= 0) virtualizer.value.scrollToIndex(index, { align: 'auto' })
})

function selectRow(sha: string): void {
  selection.select(sha)
}
</script>

<template>
  <div class="flex h-full min-w-0 flex-col bg-[var(--color-app)]">
    <!-- Column header -->
    <div
      class="flex h-8 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-3 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
    >
      <span :style="{ width: `${graphWidth - 12}px` }">Graph</span>
      <span class="flex-1">Commit</span>
      <span class="hidden w-24 text-right xl:block">Author</span>
      <span class="w-14">SHA</span>
      <span class="w-24 text-right">When</span>
    </div>

    <!-- Loading skeleton -->
    <div v-if="repo.loading" class="flex-1 space-y-2 p-3">
      <div
        v-for="n in 16"
        :key="n"
        class="h-6 animate-pulse rounded bg-[var(--color-panel-raised)]"
        :style="{ width: `${50 + ((n * 37) % 45)}%` }"
      />
    </div>

    <!-- Graph -->
    <div
      v-else
      ref="scrollEl"
      class="relative min-h-0 flex-1 overflow-auto outline-none"
      tabindex="0"
      @wheel="onWheel"
    >
      <div class="relative w-full" :style="{ height: `${totalSize}px` }">
        <svg
          class="pointer-events-none absolute top-0 left-0"
          :width="graphWidth"
          :height="totalSize"
          aria-hidden="true"
        >
          <path
            v-for="edge in visibleEdges"
            :key="edge.key"
            :d="edge.d"
            :stroke="edge.color"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
          />
          <g v-for="node in visibleNodes" :key="node.key">
            <circle
              v-if="node.selected"
              :cx="node.cx"
              :cy="node.cy"
              :r="NODE_RADIUS + 3.5"
              fill="none"
              :stroke="node.color"
              stroke-width="1.5"
              opacity="0.5"
            />
            <circle
              :cx="node.cx"
              :cy="node.cy"
              :r="NODE_RADIUS"
              :fill="node.merge ? 'var(--color-app)' : node.color"
              :stroke="node.color"
              stroke-width="2"
            />
          </g>
        </svg>

        <div
          v-for="item in virtualItems"
          :key="item.index"
          class="absolute right-0 left-0"
          :style="{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }"
        >
          <div
            class="group/row h-full cursor-pointer border-l-2 transition-colors"
            :class="
              selectedSha === repo.commits[item.index]?.sha
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                : 'border-transparent hover:bg-[var(--color-hover)]/60'
            "
            role="row"
            :aria-selected="selectedSha === repo.commits[item.index]?.sha"
            @click="selectRow(repo.commits[item.index].sha)"
            @mouseenter="selection.hover(repo.commits[item.index].sha)"
          >
            <CommitRow
              :commit="repo.commits[item.index]"
              :graph-width="graphWidth"
              :selected="selectedSha === repo.commits[item.index]?.sha"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
