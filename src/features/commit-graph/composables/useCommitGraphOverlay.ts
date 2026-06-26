import { computed, type ComputedRef } from 'vue'
import { storeToRefs } from 'pinia'
import { graphEdgePath } from '@/lib/graph/graphEdgePath'
import {
  PENDING_ROW_VIRTUAL_INDEX,
  virtualIndexForCommit,
} from '@/lib/graph/pendingGraphRow'
import { useRepositoryStore } from '@/stores/repository'
import { useSelectionStore } from '@/stores/selection'
import type { Author } from '@/types/git'
import { laneX, LANE_LEFT_PAD, LANE_RIGHT_PAD, rowCenterY } from './useCommitGraphZoom'

export interface VisibleEdge {
  key: string
  d: string
  color: string
  dashed?: boolean
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
}

export function useCommitGraphOverlay(options: {
  virtualItems: ComputedRef<{ index: number }[]>
  hasPendingRow: ComputedRef<boolean>
  headIndex: ComputedRef<number>
  pendingRowSelected: ComputedRef<boolean>
  rowHeight: ComputedRef<number>
  laneWidth: ComputedRef<number>
  resolveCommitIndex: (virtualIndex: number) => number | null
}) {
  const repo = useRepositoryStore()
  const selection = useSelectionStore()
  const { selectedSha } = storeToRefs(selection)
  const {
    virtualItems,
    hasPendingRow,
    headIndex,
    pendingRowSelected,
    rowHeight,
    laneWidth,
    resolveCommitIndex,
  } = options

  const graphContentWidth = computed(
    () =>
      LANE_LEFT_PAD +
      LANE_RIGHT_PAD +
      Math.max(1, repo.layout.maxLanes) * laneWidth.value,
  )

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
        const y1 = rowCenterY(virtualIndexForCommit(band, hasPendingRow.value), rowHeight)
        const y2 = rowCenterY(virtualIndexForCommit(band + 1, hasPendingRow.value), rowHeight)
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i]
          const x1 = laneX(seg.fromLane, laneWidth)
          const x2 = laneX(seg.toLane, laneWidth)
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
          const x = laneX(headNode.lane, laneWidth)
          const y1 = rowCenterY(PENDING_ROW_VIRTUAL_INDEX, rowHeight)
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

    return edges
  })

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
          cx: laneX(headNode.lane, laneWidth),
          cy: rowCenterY(PENDING_ROW_VIRTUAL_INDEX, rowHeight),
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
        cx: laneX(node.lane, laneWidth),
        cy: rowCenterY(item.index, rowHeight),
        color: node.color,
        selected: node.sha === selectedSha.value,
        merge: commit.isMerge,
        author: commit.author,
      })
    }

    return nodes
  })

  return { graphContentWidth, visibleEdges, visibleNodes, laneX: (lane: number) => laneX(lane, laneWidth) }
}
