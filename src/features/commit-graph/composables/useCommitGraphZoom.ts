import { computed, ref, type Ref } from 'vue'

export const BASE_ROW_HEIGHT = 35
export const BASE_LANE_WIDTH = 18
export const BASE_NODE_SIZE = 18
export const LANE_LEFT_PAD = 44
export const LANE_RIGHT_PAD = 14
export const DEFAULT_ZOOM = 1.15
export const MIN_ZOOM = 0.75
export const MAX_ZOOM = 1.6
export const ZOOM_STEP = 0.1
export const MIN_ZOOM_PERCENT = Math.round((MIN_ZOOM / DEFAULT_ZOOM) * 100)
export const MAX_ZOOM_PERCENT = Math.round((MAX_ZOOM / DEFAULT_ZOOM) * 100)
export const ZOOM_PRESETS = [MIN_ZOOM_PERCENT, 70, 80, 90, 100, 110, 120, 130, MAX_ZOOM_PERCENT]

const zoom = ref(DEFAULT_ZOOM)

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export function useCommitGraphZoom() {
  const zoomPercent = computed(() => Math.round((zoom.value / DEFAULT_ZOOM) * 100))
  const canZoomIn = computed(() => zoom.value < MAX_ZOOM)
  const canZoomOut = computed(() => zoom.value > MIN_ZOOM)
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
    zoom.value = clampZoom(next)
  }

  function zoomIn(): void {
    zoom.value = clampZoom(zoom.value + ZOOM_STEP)
  }

  function zoomOut(): void {
    zoom.value = clampZoom(zoom.value - ZOOM_STEP)
  }

  function resetZoom(): void {
    zoom.value = DEFAULT_ZOOM
  }

  function setZoomPercent(percent: number): void {
    zoom.value = clampZoom((DEFAULT_ZOOM * percent) / 100)
  }

  return { zoom, zoomPercent, canZoomIn, canZoomOut, rowHeight, laneWidth, nodeSize, selectionRingRadius, onWheel, zoomIn, zoomOut, resetZoom, setZoomPercent }
}

export function laneX(lane: number, laneWidth: Ref<number> | number): number {
  const width = typeof laneWidth === 'number' ? laneWidth : laneWidth.value
  return LANE_LEFT_PAD + lane * width + width / 2
}

export function rowCenterY(virtualIndex: number, rowHeight: Ref<number> | number): number {
  const height = typeof rowHeight === 'number' ? rowHeight : rowHeight.value
  return virtualIndex * height + height / 2
}
