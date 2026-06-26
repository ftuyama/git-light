import { computed, ref, type Ref } from 'vue'

export const BASE_ROW_HEIGHT = 30
export const BASE_LANE_WIDTH = 16
export const BASE_NODE_SIZE = 16
export const LANE_LEFT_PAD = 44
export const LANE_RIGHT_PAD = 14
const DEFAULT_ZOOM = 1.15

export function useCommitGraphZoom() {
  const zoom = ref(DEFAULT_ZOOM)
  const rowHeight = computed(() => Math.round(BASE_ROW_HEIGHT * zoom.value))
  const laneWidth = computed(() => Math.round(BASE_LANE_WIDTH * zoom.value))
  const nodeSize = computed(() => Math.round(BASE_NODE_SIZE * zoom.value))
  const selectionRingRadius = computed(
    () => nodeSize.value / 2 + 3.5 * (nodeSize.value / BASE_NODE_SIZE),
  )

  function onWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    const next = zoom.value * (1 - event.deltaY * 0.0015)
    zoom.value = Math.min(1.6, Math.max(0.75, next))
  }

  return { zoom, rowHeight, laneWidth, nodeSize, selectionRingRadius, onWheel }
}

export function laneX(lane: number, laneWidth: Ref<number> | number): number {
  const width = typeof laneWidth === 'number' ? laneWidth : laneWidth.value
  return LANE_LEFT_PAD + lane * width + width / 2
}

export function rowCenterY(virtualIndex: number, rowHeight: Ref<number> | number): number {
  const height = typeof rowHeight === 'number' ? rowHeight : rowHeight.value
  return virtualIndex * height + height / 2
}
