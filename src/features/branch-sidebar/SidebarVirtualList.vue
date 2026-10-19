<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { visibleRows } from './virtualWindow'

/**
 * Windowing wrapper for one sidebar section.
 *
 * Every section shares a single scroller (`BranchSidebar.vue` provides it), and
 * a real repository can have thousands of rows there: erp has 1,703 remote
 * branches and 775 tags. Mounting one row per entry — each a reka-ui
 * context-menu root — made the first paint after a tab switch take ~5s. Only
 * the rows inside the viewport are rendered; the container keeps the full
 * height so the shared scrollbar stays accurate.
 *
 * Fixed row heights are assumed, which holds for every windowed section (all
 * rows are `h-7` / 28px).
 */
const props = defineProps<{ count: number; rowHeight: number }>()

defineSlots<{ default: (props: { start: number; end: number }) => unknown }>()

const scroller = inject<Ref<HTMLElement | null> | undefined>('branchSidebarScroller', undefined)
/** Bumped by the sidebar whenever sections above change height. */
const layoutTick = inject<Ref<number> | undefined>('branchSidebarLayoutTick', undefined)

const list = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(0)
const listTop = ref(0)
const onScreen = ref(true)

function measure(): void {
  const el = list.value
  const sc = scroller?.value
  if (!el || !sc) return
  // Collapsed sections stay mounted (`v-show`); nothing shows from them.
  onScreen.value = el.offsetParent !== null
  if (!onScreen.value) return
  scrollTop.value = sc.scrollTop
  viewportHeight.value = sc.clientHeight
  listTop.value = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop
}

const range = computed(() =>
  onScreen.value
    ? visibleRows({
        scrollTop: scrollTop.value,
        viewportHeight: viewportHeight.value,
        listTop: listTop.value,
        rowHeight: props.rowHeight,
        count: props.count,
      })
    : { start: 0, end: 0 },
)

const offset = computed(() => range.value.start * props.rowHeight)

let cleanup: (() => void) | null = null

onMounted(() => {
  // The provider's ref is assigned after this component mounts, hence a tick.
  void nextTick(() => {
    const sc = scroller?.value
    if (!sc) return
    const onScroll = (): void => measure()
    const onResize = (): void => measure()
    sc.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null
    observer?.observe(sc)
    cleanup = () => {
      sc.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      observer?.disconnect()
    }
    measure()
  })
})

onBeforeUnmount(() => cleanup?.())

watch(
  () => [props.count, props.rowHeight],
  () => void nextTick(measure),
)

if (layoutTick) watch(layoutTick, () => measure())
</script>

<template>
  <div ref="list" class="relative w-full" :style="{ height: `${count * rowHeight}px` }">
    <div :style="{ transform: `translateY(${offset}px)` }">
      <slot :start="range.start" :end="range.end" />
    </div>
  </div>
</template>
