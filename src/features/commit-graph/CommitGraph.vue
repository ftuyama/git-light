<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { GitCommitHorizontal, Inbox, Settings } from '@lucide/vue'
import CommitRow from './CommitRow.vue'
import PendingChangesRow from './PendingChangesRow.vue'
import StashGraphRow from './StashGraphRow.vue'
import CommitGraphHeaderCell from './CommitGraphHeaderCell.vue'
import Avatar from '@/components/ui/Avatar.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import { useRepoDiffStore } from '@/stores/repoDiff'
import ConflictPanel from '@/features/conflicts/ConflictPanel.vue'
import ConflictWarningBar from './ConflictWarningBar.vue'
import DiffPanel from '@/features/diff/DiffPanel.vue'
import {
  ROW_LEFT_PADDING,
  useCommitGraphColumns,
} from './composables/useCommitGraphColumns'
import { useCommitGraphOverlay } from './composables/useCommitGraphOverlay'
import { useCommitGraphScroll } from './composables/useCommitGraphScroll'
import {
  useCommitGraphSelection,
  useCommitGraphState,
} from './composables/useCommitGraphSelection'
import { useCommitGraphVirtualList } from './composables/useCommitGraphVirtualList'
import { useCommitGraphZoom } from './composables/useCommitGraphZoom'
import { useUiStore } from '@/stores/ui'
import { commitMatchesFilter, isGraphFiltering, stashMatchesFilter } from '@/lib/graph/graphFilter'
import { buildCommitIndex } from '@/lib/graph/commitIndex'
import { buildTimeMarkers } from '@/lib/graph/timeMarkers'

const { t } = useI18n()
const diffStore = useRepoDiffStore()
const ui = useUiStore()
/** Width of the body's vertical scrollbar, reserved on the header side too. */
const scrollbarWidth = ref(0)
const { repo, showLoading, hasPendingRow, headIndex, pendingRowSelected } = useCommitGraphState()
const {
  selectedSha,
  selectRow,
  selectPendingRow,
  selectStashRow,
  rowClasses,
  selection,
} = useCommitGraphSelection()
const {
  columns,
  columnWidths,
  refsColumnWidth,
  graphColumnWidth,
  columnMenu,
  fillColumn,
  headerContentWidth,
  rowContentWidth,
  resizeColumn,
} = useCommitGraphColumns(scrollbarWidth)
const { rowHeight, laneWidth, nodeSize, selectionRingRadius, onWheel } = useCommitGraphZoom()
const graphScroll = useCommitGraphScroll()
const { scrollEl, headerScrollEl, syncHorizontalScroll, onBodyScroll } = graphScroll
void headerScrollEl

/**
 * Measure the body scrollbar so the header can reserve the same width on its
 * right edge; otherwise the last header cell sits ~scrollbar-width too far right.
 */
let scrollbarObserver: ResizeObserver | undefined
function measureScrollbarWidth(): void {
  const el = scrollEl.value
  scrollbarWidth.value = el ? Math.max(0, el.offsetWidth - el.clientWidth) : 0
}
watch(
  scrollEl,
  (el) => {
    scrollbarObserver?.disconnect()
    scrollbarObserver = undefined
    if (!el) {
      scrollbarWidth.value = 0
      return
    }
    measureScrollbarWidth()
    scrollbarObserver = new ResizeObserver(measureScrollbarWidth)
    scrollbarObserver.observe(el)
  },
  { immediate: true },
)
const {
  virtualItems,
  totalSize,
  rows,
  commitVirtualByCommit,
  resolveCommitIndex,
  resolveStashIndex,
  isPendingIndex,
  virtualIndexForCommitIndex,
} = useCommitGraphVirtualList({
  scrollEl,
  rowHeight,
  hasPendingRow,
})
const { graphContentWidth, visibleEdges, visibleNodes, laneX } = useCommitGraphOverlay({
  virtualItems,
  rows,
  hasPendingRow,
  headIndex,
  pendingRowSelected,
  rowHeight,
  laneWidth,
  nodeSize,
  resolveCommitIndex,
  resolveStashIndex,
  virtualIndexForCommitIndex,
})

const stashBoxSize = computed(() => Math.max(20, nodeSize.value))

/** SHA -> commit index, rebuilt only when the commit list changes. */
const commitIndexBySha = computed(() => buildCommitIndex(repo.commits))

/** Wall clock refreshed every minute so "1 hour ago" dividers appear on time. */
const now = ref(Date.now())
let nowTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  nowTimer = setInterval(() => {
    now.value = Date.now()
  }, 60_000)
})

onUnmounted(() => {
  if (nowTimer !== undefined) clearInterval(nowTimer)
  scrollbarObserver?.disconnect()
  scrollbarObserver = undefined
})

/**
 * Time dividers, positioned on the row boundary above the first commit older
 * than each threshold. Detached stash rows belong to that commit, so the
 * divider is lifted above them to sit between two commits.
 */
const timeMarkers = computed(() => {
  if (!ui.showTimeMarkers) return []
  const virtualByCommit = commitVirtualByCommit.value
  const rowsList = rows.value
  return buildTimeMarkers(repo.commits, now.value).flatMap((marker) => {
    const commitVirtual = virtualByCommit.get(marker.commitIndex)
    if (commitVirtual == null) return []
    let top = commitVirtual
    while (top > 0 && rowsList[top - 1]?.kind === 'stash') top--
    return [{ ...marker, y: top * rowHeight.value }]
  })
})

/** Tooltip for the dotted stash box; names the base when it is floating. */
function stashBoxTitle(stashIndex: number): string {
  const stash = repo.stashes[stashIndex]
  if (!stash?.baseSha) return t('graph.stashRow.boxTitleNoBase')
  const sha = stash.baseSha.slice(0, 7)
  const anchored = commitIndexBySha.value.has(stash.baseSha)
  if (anchored) return t('graph.stashRow.boxTitle', { sha })
  if (stash.baseSubject) {
    return t('graph.stashRow.boxTitleOutsideViewWithSubject', {
      sha,
      subject: stash.baseSubject,
    })
  }
  return t('graph.stashRow.boxTitleOutsideView', { sha })
}

const graphFilterText = computed(() => selection.graphFilter ?? '')
const isFiltering = computed(() => isGraphFiltering(graphFilterText.value))

function isCommitDimmed(commitIndex: number): boolean {
  if (!isFiltering.value) return false
  const commit = repo.commits[commitIndex]
  return commit ? !commitMatchesFilter(commit, graphFilterText.value) : false
}

function isStashDimmed(stashIndex: number): boolean {
  if (!isFiltering.value) return false
  const stash = repo.stashes[stashIndex]
  return stash ? !stashMatchesFilter(stash, graphFilterText.value) : false
}

function isEditableDblClickTarget(event: Event): boolean {
  const target = event.target
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, [contenteditable="true"]'))
}

function checkoutCommitAt(commitIndex: number, event?: Event): void {
  if (event && isEditableDblClickTarget(event)) return
  if (selection.branchCreation) return
  const sha = repo.commits[commitIndex]?.sha
  if (!sha) return
  void repo.runAction({ kind: 'checkout-commit', target: sha })
}
</script>

<template>
  <div class="flex h-full min-w-0 flex-col bg-[var(--color-app)]">
    <div class="graph-terminal-split min-h-0 flex-1">
      <div class="h-full">
        <div class="flex h-full min-w-0 flex-col bg-[var(--color-app)]">
          <div v-show="!diffStore.selectedFilePath" class="flex min-h-0 flex-1 flex-col">
    <!-- Column header -->
    <div
      class="relative flex h-8 shrink-0 items-stretch border-b border-[var(--color-border)]"
    >
      <div
        ref="headerScrollEl"
        class="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        @scroll="syncHorizontalScroll('header')"
      >
        <div
          class="flex h-full items-center pr-3 pl-3 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
          :style="{
            minWidth: `${headerContentWidth}px`,
            paddingRight: `${ROW_LEFT_PADDING + scrollbarWidth}px`,
          }"
        >
          <CommitGraphHeaderCell
            :label="$t('graph.columns.refs')"
            :width="refsColumnWidth"
            resizable
            @resize="resizeColumn('refs', $event)"
          />
          <CommitGraphHeaderCell
            :label="$t('graph.columns.graph')"
            :width="graphColumnWidth"
            resizable
            @resize="resizeColumn('graph', $event)"
          />
          <CommitGraphHeaderCell
            :label="$t('common.labels.commit')"
            :width="columnWidths.commit"
            :grow="fillColumn === 'commit'"
            resizable
            @resize="resizeColumn('commit', $event)"
          />
          <CommitGraphHeaderCell
            v-if="columns.author"
            :label="$t('common.labels.author')"
            :width="columnWidths.author"
            :grow="fillColumn === 'author'"
            align="right"
            resizable
            @resize="resizeColumn('author', $event)"
          />
          <CommitGraphHeaderCell
            v-if="columns.sha"
            :label="$t('graph.columns.sha')"
            :width="columnWidths.sha"
            :grow="fillColumn === 'sha'"
            resizable
            @resize="resizeColumn('sha', $event)"
          />
          <CommitGraphHeaderCell
            v-if="columns.when"
            :label="$t('graph.columns.when')"
            :width="columnWidths.when"
            :grow="fillColumn === 'when'"
            align="right"
            resizable
            @resize="resizeColumn('when', $event)"
          />
        </div>
      </div>
      <div class="absolute top-0 right-0 z-10 flex h-full items-center pr-3">
        <DropdownMenu :items="columnMenu" align="end">
          <button
            class="app-no-drag focus-ring ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
            :title="$t('graph.showColumns')"
            :aria-label="$t('graph.showColumns')"
          >
            <Settings :size="14" />
          </button>
        </DropdownMenu>
      </div>
    </div>

    <ConflictWarningBar />

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
      <p class="text-[14px] font-medium text-[var(--color-fg-muted)]">{{ $t('graph.empty.title') }}</p>
      <p class="max-w-xs text-[12px] text-[var(--color-fg-subtle)]">
        {{ $t('graph.empty.body') }}
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
              :stroke-linecap="edge.dashed ? 'round' : 'butt'"
              stroke-linejoin="round"
              :stroke-dasharray="edge.dashed ? '5 4' : undefined"
              :opacity="edge.dimmed ? 0.2 : 1"
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
              class="absolute flex items-center justify-center transition-opacity"
              :style="
                node.stash
                  ? {
                      width: `${stashBoxSize}px`,
                      height: `${stashBoxSize}px`,
                      left: `${node.cx - stashBoxSize / 2}px`,
                      top: `${node.cy - stashBoxSize / 2}px`,
                      opacity: node.dimmed ? 0.3 : 1,
                    }
                  : {
                      width: `${nodeSize}px`,
                      height: `${nodeSize}px`,
                      left: `${node.cx - nodeSize / 2}px`,
                      top: `${node.cy - nodeSize / 2}px`,
                      opacity: node.dimmed ? 0.3 : 1,
                    }
              "
            >
              <div
                v-if="node.stash"
                class="flex h-full w-full items-center justify-center bg-[var(--color-app)]"
                :style="{
                  border: '2px dotted var(--color-info)',
                  borderRadius: '5px',
                }"
                :title="stashBoxTitle(node.stashIndex ?? -1)"
              >
                <Inbox :size="13" class="text-[var(--color-info)]" />
              </div>
              <Avatar
                v-else-if="!node.pending && node.author"
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
          class="absolute right-0 left-0"
          :style="{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }"
        >
          <div
            v-if="resolveStashIndex(item.index) !== null"
            class="group/row h-full cursor-pointer border-l-2 transition-colors"
            :class="[
              selection.selectedStash ===
              repo.stashes[resolveStashIndex(item.index)!]?.id
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                : 'border-transparent hover:bg-[var(--color-hover)]/25',
              isStashDimmed(resolveStashIndex(item.index)!) ? 'opacity-40' : '',
            ]"
            role="row"
            :aria-selected="
              selection.selectedStash ===
              repo.stashes[resolveStashIndex(item.index)!]?.id
            "
            @click="
              selectStashRow(repo.stashes[resolveStashIndex(item.index)!].id)
            "
          >
            <StashGraphRow
              :stash="repo.stashes[resolveStashIndex(item.index)!]"
              :graph-width="graphColumnWidth"
              :row-height="rowHeight"
              :fill-column="fillColumn"
              :selected="
                selection.selectedStash ===
                repo.stashes[resolveStashIndex(item.index)!]?.id
              "
            />
          </div>
          <div
            v-else-if="isPendingIndex(item.index)"
            class="group/row h-full cursor-pointer border-l-2 transition-colors"
            :class="
              pendingRowSelected
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                : 'border-transparent hover:bg-[var(--color-hover)]/25'
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
              :fill-column="fillColumn"
              :selected="pendingRowSelected"
            />
          </div>
          <div
            v-else
            class="group/row h-full cursor-pointer border-l-2 transition-colors"
            :class="[
              rowClasses(resolveCommitIndex(item.index)!),
              isCommitDimmed(resolveCommitIndex(item.index)!) ? 'opacity-40' : '',
            ]"
            role="row"
            :aria-selected="selectedSha === repo.commits[resolveCommitIndex(item.index)!]?.sha"
            @click="selectRow(repo.commits[resolveCommitIndex(item.index)!].sha, $event)"
            @dblclick="checkoutCommitAt(resolveCommitIndex(item.index)!, $event)"
            @mouseenter="selection.hover(repo.commits[resolveCommitIndex(item.index)!].sha)"
            @mouseleave="selection.hover(null)"
          >
            <CommitRow
              :commit="repo.commits[resolveCommitIndex(item.index)!]"
              :commit-index="resolveCommitIndex(item.index)!"
              :graph-node="repo.layout.nodes[resolveCommitIndex(item.index)!] ?? null"
              :graph-width="graphColumnWidth"
              :node-x="laneX(repo.layout.nodes[resolveCommitIndex(item.index)!]?.lane ?? 0)"
              :node-size="nodeSize"
              :row-height="rowHeight"
              :fill-column="fillColumn"
              :selected="selectedSha === repo.commits[resolveCommitIndex(item.index)!]?.sha"
            />
          </div>
        </div>

        <!-- Time dividers ("a week ago"): a hairline across the row boundary
             with a small tag pinned to the right edge of the viewport. -->
        <div class="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
          <div
            v-for="marker in timeMarkers"
            :key="marker.key"
            class="absolute right-0 left-0"
            :style="{ top: `${marker.y}px` }"
          >
            <div
              class="absolute inset-x-0 top-0 h-px bg-[var(--color-border-strong)] opacity-80"
            />
            <div class="flex justify-end pr-2">
              <span
                class="sticky right-2 -translate-y-1/2 rounded border border-[var(--color-border-strong)] bg-[var(--color-panel-raised)] px-1.5 py-px text-[10px] leading-4 text-[var(--color-fg-muted)]"
              >
                {{ $t(marker.labelKey) }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="repo.loadingMoreCommits"
        class="sticky bottom-0 flex items-center justify-center py-2 text-[12px] text-[var(--color-fg-subtle)]"
      >
        {{ $t('graph.loadingMore') }}
      </div>
    </div>
    </div>

          <ConflictPanel v-if="diffStore.selectedFileIsConflicted" />
          <DiffPanel v-else-if="diffStore.panelMode === 'diff'" />
        </div>
      </div>
    </div>
  </div>
</template>
