<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { Columns3 } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import CommitRow from './CommitRow.vue'
import CommitGraphHeaderCell from './CommitGraphHeaderCell.vue'
import Avatar from '@/components/ui/Avatar.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import type { MenuItem } from '@/components/ui/menu'
import { graphEdgePath } from '@/lib/graph/graphEdgePath'
import { useRepositoryStore } from '@/stores/repository'
import { useSelectionStore } from '@/stores/selection'
import { useUiStore } from '@/stores/ui'
import type { CommitColumnWidthKey } from '@/lib/preferences'
import type { Author } from '@/types/git'

const repo = useRepositoryStore()
const selection = useSelectionStore()
const ui = useUiStore()
const { selectedSha } = storeToRefs(selection)
const { columns, columnWidths } = storeToRefs(ui)

const columnMenu = computed<MenuItem[]>(() => [
  {
    label: 'Author',
    checked: ui.isColumnVisible('author'),
    onSelect: () => ui.toggleColumn('author'),
  },
  {
    label: 'SHA',
    checked: ui.isColumnVisible('sha'),
    onSelect: () => ui.toggleColumn('sha'),
  },
  {
    label: 'When',
    checked: ui.isColumnVisible('when'),
    onSelect: () => ui.toggleColumn('when'),
  },
])

const BASE_ROW_HEIGHT = 30
const BASE_LANE_WIDTH = 16
const LANE_PAD = 14
const BASE_NODE_SIZE = 16

const refsColumnWidth = computed(() => columnWidths.value.refs)

const showLoading = computed(() => repo.loading || repo.branchSwitching)
const zoom = ref(1)
const rowHeight = computed(() => Math.round(BASE_ROW_HEIGHT * zoom.value))
const laneWidth = computed(() => Math.round(BASE_LANE_WIDTH * zoom.value))
const nodeSize = computed(() => Math.round(BASE_NODE_SIZE * zoom.value))
const selectionRingRadius = computed(
  () => nodeSize.value / 2 + 3.5 * (nodeSize.value / BASE_NODE_SIZE),
)
const minGraphWidth = computed(
  () => LANE_PAD * 2 + Math.max(1, repo.layout.maxLanes) * laneWidth.value,
)
const graphColumnWidth = computed(() =>
  Math.max(columnWidths.value.graph, minGraphWidth.value),
)

const ROW_HORIZONTAL_PADDING = 24

const rowContentWidth = computed(() => {
  let width =
    refsColumnWidth.value + graphColumnWidth.value + columnWidths.value.commit
  if (columns.value.author) width += columnWidths.value.author
  if (columns.value.sha) width += columnWidths.value.sha
  if (columns.value.when) width += columnWidths.value.when
  return width + ROW_HORIZONTAL_PADDING
})

const scrollEl = ref<HTMLElement | null>(null)
const headerScrollEl = ref<HTMLElement | null>(null)
let syncingHorizontalScroll = false

function syncHorizontalScroll(source: 'header' | 'body'): void {
  if (syncingHorizontalScroll || !headerScrollEl.value || !scrollEl.value) return
  syncingHorizontalScroll = true
  const scrollLeft =
    source === 'body' ? scrollEl.value.scrollLeft : headerScrollEl.value.scrollLeft
  headerScrollEl.value.scrollLeft = scrollLeft
  scrollEl.value.scrollLeft = scrollLeft
  syncingHorizontalScroll = false
}

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
      const cornerRadius = Math.min(6, laneWidth.value * 0.35)
      const d = graphEdgePath(x1, y1, x2, y2, cornerRadius)
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
  author: Author
}

const visibleNodes = computed<VisibleNode[]>(() => {
  const rh = rowHeight.value
  return virtualItems.value
    .map((item): VisibleNode | null => {
      const node = repo.layout.nodes[item.index]
      const commit = repo.commits[item.index]
      if (!node || !commit) return null
      return {
        key: node.sha,
        cx: laneX(node.lane),
        cy: item.index * rh + rh / 2,
        color: node.color,
        selected: node.sha === selectedSha.value,
        merge: commit.isMerge,
        author: commit.author,
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

function resizeColumn(key: CommitColumnWidthKey, deltaX: number): void {
  if (key === 'graph') {
    const next = graphColumnWidth.value + deltaX
    ui.setColumnWidth('graph', Math.max(minGraphWidth.value, next))
    return
  }
  ui.setColumnWidth(key, columnWidths.value[key] + deltaX)
}

function selectRow(sha: string): void {
  selection.select(selectedSha.value === sha ? null : sha)
}
</script>

<template>
  <div class="flex h-full min-w-0 flex-col bg-[var(--color-app)]">
    <!-- Column header -->
    <div
      class="flex h-8 shrink-0 items-stretch border-b border-[var(--color-border)]"
    >
      <div
        ref="headerScrollEl"
        class="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        @scroll="syncHorizontalScroll('header')"
      >
        <div
          class="flex h-full items-center pr-3 pl-3 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
          :style="{ minWidth: `${rowContentWidth}px` }"
        >
          <CommitGraphHeaderCell
            label="Branch / tag"
            :width="refsColumnWidth"
            resizable
            @resize="resizeColumn('refs', $event)"
          />
          <CommitGraphHeaderCell
            label="Graph"
            :width="graphColumnWidth"
            resizable
            @resize="resizeColumn('graph', $event)"
          />
          <CommitGraphHeaderCell
            label="Commit"
            :width="columnWidths.commit"
            resizable
            @resize="resizeColumn('commit', $event)"
          />
          <CommitGraphHeaderCell
            v-if="columns.author"
            label="Author"
            :width="columnWidths.author"
            align="right"
            resizable
            @resize="resizeColumn('author', $event)"
          />
          <CommitGraphHeaderCell
            v-if="columns.sha"
            label="SHA"
            :width="columnWidths.sha"
            resizable
            @resize="resizeColumn('sha', $event)"
          />
          <CommitGraphHeaderCell
            v-if="columns.when"
            label="When"
            :width="columnWidths.when"
            align="right"
            resizable
            @resize="resizeColumn('when', $event)"
          />
        </div>
      </div>
      <div class="flex shrink-0 items-center pr-3">
        <DropdownMenu :items="columnMenu" align="end">
          <button
            class="app-no-drag focus-ring ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
            title="Show columns"
            aria-label="Show columns"
          >
            <Columns3 :size="14" />
          </button>
        </DropdownMenu>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="showLoading" class="flex-1 space-y-2 p-3">
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
      @scroll="syncHorizontalScroll('body')"
      @wheel="onWheel"
    >
      <div
        class="relative"
        :style="{ minWidth: `${rowContentWidth}px`, height: `${totalSize}px` }"
      >
        <svg
          class="pointer-events-none absolute top-0 z-10"
          :style="{ left: `${refsColumnWidth}px` }"
          :width="graphColumnWidth"
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
          <template v-for="node in visibleNodes" :key="`sel-${node.key}`">
            <circle
              v-if="node.selected"
              :cx="node.cx"
              :cy="node.cy"
              :r="selectionRingRadius"
              fill="none"
              :stroke="node.color"
              stroke-width="1.5"
              opacity="0.5"
            />
          </template>
        </svg>

        <div
          class="pointer-events-none absolute top-0 z-10"
          :style="{
            left: `${refsColumnWidth}px`,
            width: `${graphColumnWidth}px`,
            height: `${totalSize}px`,
          }"
          aria-hidden="true"
        >
          <div
            v-for="node in visibleNodes"
            :key="node.key"
            class="absolute flex items-center justify-center"
            :style="{
              width: `${nodeSize}px`,
              height: `${nodeSize}px`,
              left: `${node.cx - nodeSize / 2}px`,
              top: `${node.cy - nodeSize / 2}px`,
            }"
          >
            <Avatar
              :author="node.author"
              :size="nodeSize"
              :ring-color="node.color"
              :merge="node.merge"
            />
          </div>
        </div>

        <div
          v-for="item in virtualItems"
          :key="item.index"
          class="absolute right-0 left-0 z-0"
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
              :graph-width="graphColumnWidth"
              :node-x="laneX(repo.layout.nodes[item.index]?.lane ?? 0)"
              :node-size="nodeSize"
              :row-height="rowHeight"
              :selected="selectedSha === repo.commits[item.index]?.sha"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
