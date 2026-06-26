<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { Columns3, GitCommitHorizontal } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import CommitRow from './CommitRow.vue'
import PendingChangesRow from './PendingChangesRow.vue'
import CommitGraphHeaderCell from './CommitGraphHeaderCell.vue'
import Avatar from '@/components/ui/Avatar.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import type { MenuItem } from '@/components/ui/menu'
import { graphEdgePath } from '@/lib/graph/graphEdgePath'
import {
  commitIndexForVirtual,
  PENDING_ROW_VIRTUAL_INDEX,
  virtualIndexForCommit,
  virtualRowCount,
} from '@/lib/graph/pendingGraphRow'
import { useRepositoryStore } from '@/stores/repository'
import { useSelectionStore } from '@/stores/selection'
import { useUiStore } from '@/stores/ui'
import DiffPanel from '@/features/diff/DiffPanel.vue'
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
const LANE_LEFT_PAD = 32
const LANE_RIGHT_PAD = 14
const BASE_NODE_SIZE = 16
const DEFAULT_ZOOM = 1.15

const refsColumnWidth = computed(() => columnWidths.value.refs)

const showLoading = computed(() => repo.loading || repo.branchSwitching)
const hasPendingRow = computed(() => repo.hasPendingChanges && repo.headCommitIndex >= 0)
const headIndex = computed(() => repo.headCommitIndex)
const pendingRowSelected = computed(() => hasPendingRow.value && !selectedSha.value)
const zoom = ref(DEFAULT_ZOOM)
const rowHeight = computed(() => Math.round(BASE_ROW_HEIGHT * zoom.value))
const laneWidth = computed(() => Math.round(BASE_LANE_WIDTH * zoom.value))
const nodeSize = computed(() => Math.round(BASE_NODE_SIZE * zoom.value))
const selectionRingRadius = computed(
  () => nodeSize.value / 2 + 3.5 * (nodeSize.value / BASE_NODE_SIZE),
)
const graphContentWidth = computed(
  () =>
    LANE_LEFT_PAD +
    LANE_RIGHT_PAD +
    Math.max(1, repo.layout.maxLanes) * laneWidth.value,
)
const graphColumnWidth = computed(() => columnWidths.value.graph)

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
    count: virtualRowCount(repo.commits.length, hasPendingRow.value),
    getScrollElement: () => scrollEl.value,
    estimateSize: () => rowHeight.value,
    overscan: 14,
  })),
)

function rowCenterY(virtualIndex: number): number {
  return virtualIndex * rowHeight.value + rowHeight.value / 2
}

function resolveCommitIndex(virtualIndex: number): number | null {
  return commitIndexForVirtual(virtualIndex, hasPendingRow.value)
}

const virtualItems = computed(() => virtualizer.value.getVirtualItems())
const totalSize = computed(() => virtualizer.value.getTotalSize())

function laneX(lane: number): number {
  return LANE_LEFT_PAD + lane * laneWidth.value + laneWidth.value / 2
}

interface VisibleEdge {
  key: string
  d: string
  color: string
  dashed?: boolean
}

const visibleEdges = computed<VisibleEdge[]>(() => {
  const items = virtualItems.value
  if (items.length === 0) return []
  const firstVirtual = items[0].index
  const lastVirtual = items[items.length - 1].index
  const edges: VisibleEdge[] = []

  const visibleCommitIndices = items
    .map((item) => resolveCommitIndex(item.index))
    .filter((index): index is number => index !== null)

  if (visibleCommitIndices.length > 0) {
    const minCommit = Math.min(...visibleCommitIndices)
    const maxCommit = Math.max(...visibleCommitIndices)
    for (let band = minCommit; band <= maxCommit; band++) {
      const segments = repo.layout.bands[band]
      if (!segments) continue
      const y1 = rowCenterY(virtualIndexForCommit(band, hasPendingRow.value))
      const y2 = rowCenterY(virtualIndexForCommit(band + 1, hasPendingRow.value))
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        const x1 = laneX(seg.fromLane)
        const x2 = laneX(seg.toLane)
        const cornerRadius = Math.min(6, laneWidth.value * 0.35)
        const d = graphEdgePath(x1, y1, x2, y2, cornerRadius, seg.kind)
        edges.push({ key: `${band}-${i}`, d, color: seg.color })
      }
    }
  }

  if (hasPendingRow.value && firstVirtual <= PENDING_ROW_VIRTUAL_INDEX) {
    const headVirtual = virtualIndexForCommit(headIndex.value, true)
    if (lastVirtual >= headVirtual) {
      const headNode = repo.layout.nodes[headIndex.value]
      if (headNode) {
        const x = laneX(headNode.lane)
        const y1 = rowCenterY(PENDING_ROW_VIRTUAL_INDEX)
        const y2 = rowCenterY(headVirtual)
        edges.push({
          key: 'pending-head',
          d: graphEdgePath(x, y1, x, y2),
          color: headNode.color,
          dashed: true,
        })
      }
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
  author?: Author
  pending?: boolean
}

const visibleNodes = computed<VisibleNode[]>(() => {
  const nodes: VisibleNode[] = []

  if (hasPendingRow.value) {
    const visible = virtualItems.value.some(
      (item) => item.index === PENDING_ROW_VIRTUAL_INDEX,
    )
    const headNode = repo.layout.nodes[headIndex.value]
    if (visible && headNode) {
      nodes.push({
        key: 'pending',
        cx: laneX(headNode.lane),
        cy: rowCenterY(PENDING_ROW_VIRTUAL_INDEX),
        color: headNode.color,
        selected: pendingRowSelected.value,
        merge: false,
        pending: true,
      })
    }
  }

  for (const item of virtualItems.value) {
    const commitIndex = resolveCommitIndex(item.index)
    if (commitIndex === null) continue
    const node = repo.layout.nodes[commitIndex]
    const commit = repo.commits[commitIndex]
    if (!node || !commit) continue
    nodes.push({
      key: node.sha,
      cx: laneX(node.lane),
      cy: rowCenterY(item.index),
      color: node.color,
      selected: node.sha === selectedSha.value,
      merge: commit.isMerge,
      author: commit.author,
    })
  }

  return nodes
})

function onWheel(event: WheelEvent): void {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  const next = zoom.value * (1 - event.deltaY * 0.0015)
  zoom.value = Math.min(1.6, Math.max(0.75, next))
}

watch(rowHeight, () => virtualizer.value.measure())

watch(selectedSha, (sha) => {
  if (sha) {
    const index = repo.commits.findIndex((c) => c.sha === sha)
    if (index >= 0) {
      virtualizer.value.scrollToIndex(
        virtualIndexForCommit(index, hasPendingRow.value),
        { align: 'auto' },
      )
    }
    return
  }
  if (hasPendingRow.value) {
    virtualizer.value.scrollToIndex(PENDING_ROW_VIRTUAL_INDEX, { align: 'auto' })
  }
})

function resizeColumn(key: CommitColumnWidthKey, deltaX: number): void {
  ui.setColumnWidth(key, columnWidths.value[key] + deltaX)
}

function selectRow(sha: string): void {
  selection.select(selectedSha.value === sha ? null : sha)
}

function selectPendingRow(): void {
  selection.select(null)
}

function onBodyScroll(): void {
  syncHorizontalScroll('body')
  if (!scrollEl.value || repo.loadingMoreCommits || !repo.commitPage.hasMore) return
  const el = scrollEl.value
  const threshold = 200
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
    void repo.loadMoreCommits()
  }
}
</script>

<template>
  <div class="flex h-full min-w-0 flex-col bg-[var(--color-app)]">
    <div v-show="!repo.selectedFilePath" class="flex min-h-0 flex-1 flex-col">
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

    <!-- Empty state -->
    <div
      v-else-if="repo.commits.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center"
    >
      <GitCommitHorizontal :size="32" class="text-[var(--color-fg-subtle)]" />
      <p class="text-[14px] font-medium text-[var(--color-fg-muted)]">No commits yet</p>
      <p class="max-w-xs text-[12px] text-[var(--color-fg-subtle)]">
        Make your first commit to see history appear here.
      </p>
    </div>

    <!-- Graph -->
    <div
      v-else
      ref="scrollEl"
      class="relative min-h-0 flex-1 overflow-auto outline-none"
      tabindex="0"
      @scroll="onBodyScroll"
      @wheel="onWheel"
    >
      <div
        class="relative"
        :style="{ minWidth: `${rowContentWidth}px`, height: `${totalSize}px` }"
      >
        <div
          class="pointer-events-none absolute top-0 z-10 overflow-hidden"
          :style="{
            left: `${refsColumnWidth}px`,
            width: `${graphColumnWidth}px`,
            height: `${totalSize}px`,
          }"
          aria-hidden="true"
        >
          <svg :width="graphContentWidth" :height="totalSize">
            <path
              v-for="edge in visibleEdges"
              :key="edge.key"
              :d="edge.d"
              :stroke="edge.color"
              stroke-width="2"
              fill="none"
              stroke-linecap="butt"
              stroke-linejoin="miter"
              :stroke-dasharray="edge.dashed ? '5 4' : undefined"
            />
            <template v-for="node in visibleNodes" :key="`sel-${node.key}`">
              <circle
                v-if="node.pending"
                :cx="node.cx"
                :cy="node.cy"
                :r="nodeSize / 2 - 1"
                fill="var(--color-app)"
                :stroke="node.color"
                stroke-width="2"
                stroke-dasharray="3 2"
              />
              <circle
                v-else-if="node.selected"
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
            class="absolute top-0 left-0"
            :style="{ width: `${graphContentWidth}px`, height: `${totalSize}px` }"
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
                v-if="!node.pending && node.author"
                :author="node.author"
                :size="nodeSize"
                :ring-color="node.color"
                :merge="node.merge"
              />
            </div>
          </div>
        </div>

        <div
          v-for="item in virtualItems"
          :key="item.index"
          class="absolute right-0 left-0 z-0"
          :style="{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }"
        >
          <div
            v-if="resolveCommitIndex(item.index) === null"
            class="group/row h-full cursor-pointer border-l-2 transition-colors"
            :class="
              pendingRowSelected
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                : 'border-transparent hover:bg-[var(--color-hover)]/60'
            "
            role="row"
            :aria-selected="pendingRowSelected"
            @click="selectPendingRow()"
          >
            <PendingChangesRow
              :graph-width="graphColumnWidth"
              :node-x="laneX(repo.layout.nodes[headIndex]?.lane ?? 0)"
              :node-size="nodeSize"
              :row-height="rowHeight"
              :selected="pendingRowSelected"
            />
          </div>
          <div
            v-else
            class="group/row h-full cursor-pointer border-l-2 transition-colors"
            :class="
              selectedSha === repo.commits[resolveCommitIndex(item.index)!]?.sha
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                : 'border-transparent hover:bg-[var(--color-hover)]/60'
            "
            role="row"
            :aria-selected="selectedSha === repo.commits[resolveCommitIndex(item.index)!]?.sha"
            @click="selectRow(repo.commits[resolveCommitIndex(item.index)!].sha)"
            @mouseenter="selection.hover(repo.commits[resolveCommitIndex(item.index)!].sha)"
          >
            <CommitRow
              :commit="repo.commits[resolveCommitIndex(item.index)!]"
              :graph-width="graphColumnWidth"
              :node-x="laneX(repo.layout.nodes[resolveCommitIndex(item.index)!]?.lane ?? 0)"
              :node-size="nodeSize"
              :row-height="rowHeight"
              :selected="selectedSha === repo.commits[resolveCommitIndex(item.index)!]?.sha"
            />
          </div>
        </div>
      </div>
      <div
        v-if="repo.loadingMoreCommits"
        class="sticky bottom-0 flex items-center justify-center py-2 text-[12px] text-[var(--color-fg-subtle)]"
      >
        Loading more commits…
      </div>
    </div>
    </div>

    <DiffPanel />
  </div>
</template>
