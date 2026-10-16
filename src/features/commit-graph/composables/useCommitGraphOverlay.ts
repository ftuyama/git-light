import { computed, type ComputedRef } from 'vue'
import { storeToRefs } from 'pinia'
import { graphEdgePath } from '@/lib/graph/graphEdgePath'
import { commitMatchesFilter, isGraphFiltering, stashMatchesFilter } from '@/lib/graph/graphFilter'
import { stashVirtualIndexByStash } from '@/lib/graph/stashGraphRows'
import { buildCommitIndex } from '@/lib/graph/commitIndex'
import type { GraphRow } from '@/lib/graph/stashGraphRows'
import { useRepositoryStore } from '@/stores/repository'
import { useSelectionStore } from '@/stores/selection'
import type { Author } from '@/types/git'
import { laneX, LANE_LEFT_PAD, LANE_RIGHT_PAD, rowCenterY } from './useCommitGraphZoom'

export interface VisibleEdge {
  key: string
  d: string
  color: string
  dashed?: boolean
  dimmed?: boolean
}

export interface VisibleNode {
  key: string
  cx: number
  cy: number
  color: string
  selected: boolean
  merge: boolean
  author?: Author
  pending?: boolean
  stash?: boolean
  stashIndex?: number
  dimmed?: boolean
}

export function useCommitGraphOverlay(options: {
  virtualItems: ComputedRef<{ index: number }[]>
  rows: ComputedRef<GraphRow[]>
  hasPendingRow: ComputedRef<boolean>
  headIndex: ComputedRef<number>
  pendingRowSelected: ComputedRef<boolean>
  rowHeight: ComputedRef<number>
  laneWidth: ComputedRef<number>
  resolveCommitIndex: (virtualIndex: number) => number | null
  resolveStashIndex: (virtualIndex: number) => number | null
  virtualIndexForCommitIndex: (commitIndex: number) => number
  stashBoxX: (stashIndex: number) => number
}) {
  const repo = useRepositoryStore()
  const selection = useSelectionStore()
  const { selectedSha, selectedStash, graphFilter } = storeToRefs(selection)
  const {
    virtualItems,
    rows,
    hasPendingRow,
    headIndex,
    pendingRowSelected,
    rowHeight,
    laneWidth,
    resolveCommitIndex,
    resolveStashIndex,
    virtualIndexForCommitIndex,
    stashBoxX,
  } = options

  const graphContentWidth = computed(
    () =>
      LANE_LEFT_PAD +
      LANE_RIGHT_PAD +
      (Math.max(1, repo.layout.maxLanes) + (repo.stashes.length > 0 ? 1 : 0)) *
        laneWidth.value,
  )

  const commitIndexBySha = computed(() => buildCommitIndex(repo.commits))
  const stashVirtualByStashMap = computed(() => stashVirtualIndexByStash(rows.value))

  const visibleEdges = computed<VisibleEdge[]>(() => {
    const items = virtualItems.value
    if (items.length === 0) return []
    const edges: VisibleEdge[] = []
    const filtering = isGraphFiltering(graphFilter.value)

    const isCommitDimmed = (commitIndex: number): boolean => {
      if (!filtering) return false
      const commit = repo.commits[commitIndex]
      return commit ? !commitMatchesFilter(commit, graphFilter.value) : false
    }

    const visibleCommitIndices = items
      .map((item) => resolveCommitIndex(item.index))
      .filter((index): index is number => index !== null)

    if (visibleCommitIndices.length > 0) {
      const minCommit = Math.min(...visibleCommitIndices)
      const maxCommit = Math.max(...visibleCommitIndices)
      for (let band = minCommit; band <= maxCommit; band++) {
        const segments = repo.layout.bands[band]
        if (!segments) continue
        // Bands connect consecutive commit rows; stash/pending rows inserted
        // between them shift Y positions via the row map.
        const y1 = rowCenterY(virtualIndexForCommitIndex(band), rowHeight)
        const nextVirtual =
          band + 1 < repo.commits.length
            ? virtualIndexForCommitIndex(band + 1)
            : virtualIndexForCommitIndex(band) + 1
        const y2 = rowCenterY(nextVirtual, rowHeight)
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i]
          const x1 = laneX(seg.fromLane, laneWidth)
          const x2 = laneX(seg.toLane, laneWidth)
          const cornerRadius = Math.min(
            seg.kind === 'merge' ? 9 : 6,
            laneWidth.value * 0.35,
          )
          const d = graphEdgePath(x1, y1, x2, y2, cornerRadius, seg.kind)
          edges.push({ key: `${band}-${i}`, d, color: seg.color, dimmed: isCommitDimmed(band) })
        }
      }
    }

    const pendingVirtual = rows.value.findIndex((row) => row.kind === 'pending')
    if (
      hasPendingRow.value &&
      pendingVirtual >= 0 &&
      items[0].index <= pendingVirtual
    ) {
      const headVirtual = virtualIndexForCommitIndex(headIndex.value)
      if (items[items.length - 1].index >= headVirtual && headVirtual >= 0) {
        const headNode = repo.layout.nodes[headIndex.value]
        if (headNode) {
          const x = laneX(headNode.lane, laneWidth)
          const y1 = rowCenterY(pendingVirtual, rowHeight)
          const y2 = rowCenterY(headVirtual, rowHeight)
          edges.push({
            key: 'pending-head',
            d: graphEdgePath(x, y1, x, y2),
            color: headNode.color,
            dashed: true,
          })
        }
      }
    }

    // Dotted connector anchored at the base commit circle: horizontal off
    // the base commit, then a rounded corner into the stash lane and up to
    // the stash box. Stashes without a loaded base commit stay floating
    // with no line.
    {
      const stashVirtualByStash = stashVirtualByStashMap.value
      const firstVisible = items[0].index
      const lastVisible = items[items.length - 1].index
      const indexBySha = commitIndexBySha.value
      repo.stashes.forEach((stash, stashIndex) => {
        const stashVirtual = stashVirtualByStash.get(stashIndex)
        if (stashVirtual == null) return
        if (stashVirtual < firstVisible || stashVirtual > lastVisible) return
        const baseIndex = stash.baseSha ? (indexBySha.get(stash.baseSha) ?? -1) : -1
        if (baseIndex < 0) return
        const baseNode = repo.layout.nodes[baseIndex]
        if (!baseNode) return
        const baseVirtual = virtualIndexForCommitIndex(baseIndex)
        if (baseVirtual < firstVisible || baseVirtual > lastVisible) return
        const baseX = laneX(baseNode.lane, laneWidth)
        const boxX = stashBoxX(stashIndex)
        const stashY = rowCenterY(stashVirtual, rowHeight)
        const baseY = rowCenterY(baseVirtual, rowHeight)
        edges.push({
          key: `stash-${stashIndex}`,
          d: graphEdgePath(baseX, baseY, boxX, stashY, 9, 'merge'),
          color: 'var(--color-info)',
          dashed: true,
          dimmed: filtering && !stashMatchesFilter(stash, graphFilter.value),
        })
      })
    }

    return edges
  })

  const visibleNodes = computed<VisibleNode[]>(() => {
    const nodes: VisibleNode[] = []
    const filtering = isGraphFiltering(graphFilter.value)

    if (hasPendingRow.value) {
      const pendingVirtual = rows.value.findIndex((row) => row.kind === 'pending')
      const visible =
        pendingVirtual >= 0 &&
        virtualItems.value.some((item) => item.index === pendingVirtual)
      const headNode = repo.layout.nodes[headIndex.value]
      if (visible && headNode) {
        nodes.push({
          key: 'pending',
          cx: laneX(headNode.lane, laneWidth),
          cy: rowCenterY(pendingVirtual, rowHeight),
          color: headNode.color,
          selected: pendingRowSelected.value,
          merge: false,
          pending: true,
        })
      }
    }

    for (const item of virtualItems.value) {
      const stashIndex = resolveStashIndex(item.index)
      if (stashIndex !== null) {
        const stash = repo.stashes[stashIndex]
        nodes.push({
          key: `stash-${stashIndex}`,
          cx: stashBoxX(stashIndex),
          cy: rowCenterY(item.index, rowHeight),
          color: 'var(--color-info)',
          selected: repo.stashes[stashIndex]?.id === selectedStash.value,
          merge: false,
          stash: true,
          stashIndex,
          dimmed: filtering && stash ? !stashMatchesFilter(stash, graphFilter.value) : false,
        })
        continue
      }
      const commitIndex = resolveCommitIndex(item.index)
      if (commitIndex === null) continue
      const node = repo.layout.nodes[commitIndex]
      const commit = repo.commits[commitIndex]
      if (!node || !commit) continue
      nodes.push({
        key: node.sha,
        cx: laneX(node.lane, laneWidth),
        cy: rowCenterY(item.index, rowHeight),
        color: node.color,
        selected: node.sha === selectedSha.value,
        merge: commit.isMerge,
        author: commit.author,
        dimmed: filtering && !commitMatchesFilter(commit, graphFilter.value),
      })
    }

    return nodes
  })

  return { graphContentWidth, visibleEdges, visibleNodes, laneX: (lane: number) => laneX(lane, laneWidth) }
}
