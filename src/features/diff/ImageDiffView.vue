<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Loader2, Minimize2, ZoomIn, ZoomOut } from '@lucide/vue'
import type { ImagePreviewRequest, ImagePreviewResult } from '@shared/git/models'
import { gitService } from '@/lib/git'
import { formatImageBytes } from '@/lib/imageFiles'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  resetTransform,
  zoomAtPoint,
  zoomStep,
  type ZoomTransform,
} from '@/lib/imageZoom'

const props = defineProps<{
  request: ImagePreviewRequest
}>()

const preview = ref<ImagePreviewResult | null>(null)
const loading = ref(false)
const failed = ref(false)
const oldDimensions = ref<string | null>(null)
const newDimensions = ref<string | null>(null)
/** Which side fills the diff container, or null for the side-by-side view. */
const expanded = ref<'old' | 'new' | null>(null)
const zoom = ref<ZoomTransform>(resetTransform())
const viewportOld = ref<HTMLDivElement | null>(null)
const viewportNew = ref<HTMLDivElement | null>(null)
let loadId = 0
let dragging = false
let lastX = 0
let lastY = 0

const showOld = computed(() => !expanded.value || expanded.value === 'old')
const showNew = computed(() => !expanded.value || expanded.value === 'new')
const percent = computed(() => `${Math.round(zoom.value.scale * 100)}%`)
const canZoomIn = computed(() => zoom.value.scale < MAX_ZOOM)
const canZoomOut = computed(() => zoom.value.scale > MIN_ZOOM)

const expandedStyle = computed(() => ({
  transform: `translate(${zoom.value.tx}px, ${zoom.value.ty}px) scale(${zoom.value.scale})`,
  cursor: zoom.value.scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
}))

function onImageLoad(e: Event, side: 'old' | 'new'): void {
  const img = e.target as HTMLImageElement | null
  if (!img) return
  const label = img.naturalWidth > 0 ? `${img.naturalWidth} × ${img.naturalHeight}px` : null
  if (side === 'old') oldDimensions.value = label
  else newDimensions.value = label
}

async function load(): Promise<void> {
  const current = ++loadId
  loading.value = true
  failed.value = false
  preview.value = null
  oldDimensions.value = null
  newDimensions.value = null
  expanded.value = null
  zoom.value = resetTransform()
  try {
    const result = await gitService.getImagePreview(props.request)
    if (current !== loadId) return
    preview.value = result
  } catch {
    if (current !== loadId) return
    failed.value = true
  } finally {
    if (current === loadId) loading.value = false
  }
}

function expand(side: 'old' | 'new'): void {
  expanded.value = side
  zoom.value = resetTransform()
}

function collapse(): void {
  expanded.value = null
  zoom.value = resetTransform()
  unbindWheel()
}

function activeViewport(): HTMLDivElement | null {
  return expanded.value === 'old' ? viewportOld.value : viewportNew.value
}

function applyStep(direction: 'in' | 'out'): void {
  const scale = zoomStep(zoom.value.scale, direction)
  if (scale === zoom.value.scale) return
  const el = activeViewport()
  if (!el) {
    zoom.value = { ...zoom.value, scale }
    return
  }
  const rect = el.getBoundingClientRect()
  zoom.value = zoomAtPoint(zoom.value, rect.width / 2, rect.height / 2, scale / zoom.value.scale)
}

function toggleZoom(): void {
  zoom.value = zoom.value.scale > 1.5 ? resetTransform() : { ...resetTransform(), scale: 2.5 }
}

function onWheel(e: WheelEvent): void {
  e.preventDefault()
  const el = activeViewport()
  if (!el) return
  const rect = el.getBoundingClientRect()
  zoom.value = zoomAtPoint(
    zoom.value,
    e.clientX - rect.left,
    e.clientY - rect.top,
    e.deltaY < 0 ? 1.15 : 1 / 1.15,
  )
}

function unbindWheel(): void {
  viewportOld.value?.removeEventListener('wheel', onWheel)
  viewportNew.value?.removeEventListener('wheel', onWheel)
}

function bindWheel(): void {
  unbindWheel()
  activeViewport()?.addEventListener('wheel', onWheel, { passive: false })
}

function onPointerDown(e: PointerEvent): void {
  dragging = true
  lastX = e.clientX
  lastY = e.clientY
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging) return
  zoom.value = {
    ...zoom.value,
    tx: zoom.value.tx + (e.clientX - lastX),
    ty: zoom.value.ty + (e.clientY - lastY),
  }
  lastX = e.clientX
  lastY = e.clientY
}

function onPointerUp(): void {
  dragging = false
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && expanded.value) collapse()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  void load()
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  unbindWheel()
})

watch(
  () => props.request,
  () => {
    void load()
  },
  { deep: true },
)

watch(expanded, () => {
  void nextTick().then(bindWheel)
})
</script>

<template>
  <div
    class="min-h-0 flex-1 p-4"
    :class="expanded ? 'flex flex-col overflow-hidden' : 'overflow-auto'"
  >
    <div
      v-if="loading"
      class="flex h-full items-center justify-center text-xs text-[var(--color-fg-subtle)]"
    >
      <Loader2 :size="16" class="mr-2 animate-spin" />
      Loading image preview…
    </div>

    <div
      v-else-if="failed"
      class="flex h-full items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
    >
      Could not load image preview.
    </div>

    <div
      v-else-if="preview?.tooLarge"
      class="flex h-full items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
    >
      Image is too large to preview in the UI.
    </div>

    <div
      v-else-if="preview && !preview.oldImage && !preview.newImage"
      class="flex h-full items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
    >
      Image preview is not available for this change.
    </div>

    <div
      v-else-if="preview"
      class="grid grid-cols-1 gap-4"
      :class="expanded ? 'min-h-0 flex-1' : 'content-start md:grid-cols-2'"
    >
      <figure
        v-if="showOld"
        class="flex min-h-0 flex-col overflow-hidden rounded border border-[var(--color-border)]"
      >
        <figcaption class="flex items-center gap-1 border-b border-[var(--color-border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-fg-muted)]">
          <span>{{ preview.newImage && !preview.oldImage ? 'Added' : 'Before' }}</span>
          <span v-if="preview.oldImage" class="font-mono font-normal text-[10px] text-[var(--color-fg-subtle)]">
            {{ formatImageBytes(preview.oldImage.sizeBytes) }}<span v-if="oldDimensions"> · {{ oldDimensions }}</span>
          </span>
          <template v-if="expanded">
            <span class="flex-1" />
            <button
              type="button"
              class="focus-ring rounded p-1 transition-colors hover:bg-[var(--color-hover)] disabled:opacity-30"
              aria-label="Zoom out"
              :disabled="!canZoomOut"
              @click="applyStep('out')"
            >
              <ZoomOut :size="14" class="block" />
            </button>
            <button
              type="button"
              class="focus-ring min-w-11 rounded px-1 py-0.5 text-center font-mono text-[10px] font-normal tabular-nums transition-colors hover:bg-[var(--color-hover)]"
              aria-label="Reset zoom"
              title="Reset zoom"
              @click="zoom = resetTransform()"
            >
              {{ percent }}
            </button>
            <button
              type="button"
              class="focus-ring rounded p-1 transition-colors hover:bg-[var(--color-hover)] disabled:opacity-30"
              aria-label="Zoom in"
              :disabled="!canZoomIn"
              @click="applyStep('in')"
            >
              <ZoomIn :size="14" class="block" />
            </button>
            <button
              type="button"
              class="focus-ring rounded p-1 transition-colors hover:bg-[var(--color-hover)]"
              aria-label="Collapse"
              title="Back to side-by-side"
              @click="collapse()"
            >
              <Minimize2 :size="14" class="block" />
            </button>
          </template>
        </figcaption>
        <div
          v-if="preview.oldImage && !expanded"
          class="image-checkerboard flex min-h-48 flex-1 items-center justify-center p-4"
        >
          <img
            :src="preview.oldImage.dataUrl"
            :alt="`Before: ${preview.path}`"
            draggable="false"
            title="Click to expand"
            class="max-h-[60vh] max-w-full cursor-zoom-in rounded object-contain shadow-sm transition-transform hover:scale-[1.01]"
            @load="(e) => onImageLoad(e, 'old')"
            @click="expand('old')"
          />
        </div>
        <div
          v-else-if="preview.oldImage"
          ref="viewportOld"
          class="image-checkerboard flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden p-4 select-none"
        >
          <img
            :src="preview.oldImage.dataUrl"
            :alt="`Before: ${preview.path}`"
            draggable="false"
            class="max-h-full max-w-full rounded object-contain shadow-sm"
            :style="expandedStyle"
            @load="(e) => onImageLoad(e, 'old')"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @dblclick="toggleZoom()"
          />
        </div>
        <div
          v-else
          class="flex min-h-48 flex-1 items-center justify-center p-4 text-xs text-[var(--color-fg-subtle)]"
        >
          No previous version (file added).
        </div>
      </figure>

      <figure
        v-if="showNew"
        class="flex min-h-0 flex-col overflow-hidden rounded border border-[var(--color-border)]"
      >
        <figcaption class="flex items-center gap-1 border-b border-[var(--color-border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-fg-muted)]">
          <span>{{ preview.oldImage && !preview.newImage ? 'Deleted' : 'After' }}</span>
          <span v-if="preview.newImage" class="font-mono font-normal text-[10px] text-[var(--color-fg-subtle)]">
            {{ formatImageBytes(preview.newImage.sizeBytes) }}<span v-if="newDimensions"> · {{ newDimensions }}</span>
          </span>
          <template v-if="expanded">
            <span class="flex-1" />
            <button
              type="button"
              class="focus-ring rounded p-1 transition-colors hover:bg-[var(--color-hover)] disabled:opacity-30"
              aria-label="Zoom out"
              :disabled="!canZoomOut"
              @click="applyStep('out')"
            >
              <ZoomOut :size="14" class="block" />
            </button>
            <button
              type="button"
              class="focus-ring min-w-11 rounded px-1 py-0.5 text-center font-mono text-[10px] font-normal tabular-nums transition-colors hover:bg-[var(--color-hover)]"
              aria-label="Reset zoom"
              title="Reset zoom"
              @click="zoom = resetTransform()"
            >
              {{ percent }}
            </button>
            <button
              type="button"
              class="focus-ring rounded p-1 transition-colors hover:bg-[var(--color-hover)] disabled:opacity-30"
              aria-label="Zoom in"
              :disabled="!canZoomIn"
              @click="applyStep('in')"
            >
              <ZoomIn :size="14" class="block" />
            </button>
            <button
              type="button"
              class="focus-ring rounded p-1 transition-colors hover:bg-[var(--color-hover)]"
              aria-label="Collapse"
              title="Back to side-by-side"
              @click="collapse()"
            >
              <Minimize2 :size="14" class="block" />
            </button>
          </template>
        </figcaption>
        <div
          v-if="preview.newImage && !expanded"
          class="image-checkerboard flex min-h-48 flex-1 items-center justify-center p-4"
        >
          <img
            :src="preview.newImage.dataUrl"
            :alt="`After: ${preview.path}`"
            draggable="false"
            title="Click to expand"
            class="max-h-[60vh] max-w-full cursor-zoom-in rounded object-contain shadow-sm transition-transform hover:scale-[1.01]"
            @load="(e) => onImageLoad(e, 'new')"
            @click="expand('new')"
          />
        </div>
        <div
          v-else-if="preview.newImage"
          ref="viewportNew"
          class="image-checkerboard flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden p-4 select-none"
        >
          <img
            :src="preview.newImage.dataUrl"
            :alt="`After: ${preview.path}`"
            draggable="false"
            class="max-h-full max-w-full rounded object-contain shadow-sm"
            :style="expandedStyle"
            @load="(e) => onImageLoad(e, 'new')"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @dblclick="toggleZoom()"
          />
        </div>
        <div
          v-else
          class="flex min-h-48 flex-1 items-center justify-center p-4 text-xs text-[var(--color-fg-subtle)]"
        >
          No current version (file deleted).
        </div>
      </figure>
    </div>
    <p
      v-if="expanded"
      class="shrink-0 pt-2 text-center text-[11px] text-[var(--color-fg-subtle)]"
    >
      Scroll to zoom · drag to pan · double-click to toggle · Esc to collapse
    </p>
  </div>
</template>

<style scoped>
.image-checkerboard {
  background-image:
    linear-gradient(45deg, var(--color-hover) 25%, transparent 25%),
    linear-gradient(-45deg, var(--color-hover) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--color-hover) 75%),
    linear-gradient(-45deg, transparent 75%, var(--color-hover) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}
</style>
