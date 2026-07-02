<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Splitpanes, Pane, type SplitpanesResizedPayload } from 'splitpanes'
import { Columns3, GitCommitHorizontal } from '@lucide/vue'
import CommitRow from './CommitRow.vue'
import PendingChangesRow from './PendingChangesRow.vue'
import CommitGraphHeaderCell from './CommitGraphHeaderCell.vue'
import Avatar from '@/components/ui/Avatar.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import TerminalPanel from '@/features/terminal/TerminalPanel.vue'
import { useRepoDiffStore } from '@/stores/repoDiff'
import { useUiStore } from '@/stores/ui'
import ConflictPanel from '@/features/conflicts/ConflictPanel.vue'
import DiffPanel from '@/features/diff/DiffPanel.vue'
import { useCommitGraphColumns } from './composables/useCommitGraphColumns'
import { useCommitGraphOverlay } from './composables/useCommitGraphOverlay'
import { useCommitGraphScroll } from './composables/useCommitGraphScroll'
import {
  useCommitGraphSelection,
  useCommitGraphState,
} from './composables/useCommitGraphSelection'
import { useCommitGraphVirtualList } from './composables/useCommitGraphVirtualList'
import { useCommitGraphZoom } from './composables/useCommitGraphZoom'

const diffStore = useRepoDiffStore()
const ui = useUiStore()
const { terminalOpen, terminalPanelSize } = storeToRefs(ui)
const graphAreaSize = computed(() => (terminalOpen.value ? 100 - terminalPanelSize.value : 100))

function onTerminalResized(payload: SplitpanesResizedPayload): void {
  if (!terminalOpen.value) return
  const terminalPane = payload.panes.at(-1)
  if (terminalPane?.size != null) ui.setTerminalPanelSize(terminalPane.size)
}
const { repo, showLoading, hasPendingRow, headIndex, pendingRowSelected } = useCommitGraphState()
const { selectedSha, selectRow, selectPendingRow, rowClasses, selection } =
  useCommitGraphSelection()
const {
  columns,
  columnWidths,
  refsColumnWidth,
  graphColumnWidth,
  columnMenu,
  rowContentWidth,
  resizeColumn,
} = useCommitGraphColumns()
const { rowHeight, laneWidth, nodeSize, selectionRingRadius, onWheel } = useCommitGraphZoom()
const graphScroll = useCommitGraphScroll()
const { scrollEl, headerScrollEl, syncHorizontalScroll, onBodyScroll } = graphScroll
void headerScrollEl
const { virtualItems, totalSize, resolveCommitIndex } = useCommitGraphVirtualList({
  scrollEl,
  rowHeight,
  hasPendingRow,
})
const { graphContentWidth, visibleEdges, visibleNodes, laneX } = useCommitGraphOverlay({
  virtualItems,
  hasPendingRow,
  headIndex,
  pendingRowSelected,
  rowHeight,
  laneWidth,
  resolveCommitIndex,
})
</script>

<template>
  <div class="flex h-full min-w-0 flex-col bg-[var(--color-app)]">
    <Splitpanes
      horizontal
      class="graph-terminal-split min-h-0 flex-1"
      @resized="onTerminalResized"
    >
      <Pane :size="graphAreaSize" :min-size="terminalOpen ? 30 : 100">
        <div class="flex h-full min-w-0 flex-col bg-[var(--color-app)]">
          <div v-show="!diffStore.selectedFilePath" class="flex min-h-0 flex-1 flex-col">
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
          class="absolute right-0 left-0 z-0 hover:z-30"
          :style="{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }"
        >
          <div
            v-if="resolveCommitIndex(item.index) === null"
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
              :selected="pendingRowSelected"
            />
          </div>
          <div
            v-else
            class="group/row h-full cursor-pointer border-l-2 transition-colors"
            :class="rowClasses(resolveCommitIndex(item.index)!)"
            role="row"
            :aria-selected="selectedSha === repo.commits[resolveCommitIndex(item.index)!]?.sha"
            @click="selectRow(repo.commits[resolveCommitIndex(item.index)!].sha, $event)"
            @mouseenter="selection.hover(repo.commits[resolveCommitIndex(item.index)!].sha)"
            @mouseleave="selection.hover(null)"
          >
            <CommitRow
              :commit="repo.commits[resolveCommitIndex(item.index)!]"
              :graph-node="repo.layout.nodes[resolveCommitIndex(item.index)!] ?? null"
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

          <ConflictPanel v-if="diffStore.selectedFileIsConflicted" />
          <DiffPanel v-else-if="diffStore.panelMode === 'diff'" />
        </div>
      </Pane>

      <Pane v-if="terminalOpen" :size="terminalPanelSize" :min-size="15">
        <TerminalPanel />
      </Pane>
    </Splitpanes>
  </div>
</template>
