<script setup lang="ts">
import { Folder, FolderGit2, Plus, X } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import IconButton from '@/components/ui/IconButton.vue'
import AppSettingsMenu from '@/features/settings/AppSettingsMenu.vue'
import { useRepoMenu } from '@/features/toolbar/useRepoMenu'
import { useRepositoryStore } from '@/stores/repository'
import { useRepoTabsStore, type RepoTab } from '@/stores/repoTabs'
import { preloadTabInBackground } from '@/stores/repo/tabPreload'
import { useToastStore } from '@/stores/toast'

const repo = useRepositoryStore()
const tabsStore = useRepoTabsStore()
const { repoMenu } = useRepoMenu()
const { tabs, activePath } = storeToRefs(tabsStore)

const tabsRow = ref<HTMLElement | null>(null)
const draggingPath = ref<string | null>(null)
const dragOrder = ref<RepoTab[] | null>(null)
const displayTabs = computed(() => dragOrder.value ?? tabs.value)
let suppressClick = false
let dragStart: { path: string; x: number; y: number } | null = null

/** Reorder the live preview so the dragged tab follows the pointer. */
function previewOrder(path: string, clientX: number): void {
  const order = dragOrder.value
  const row = tabsRow.value
  if (!order || !row) return

  const dragged = order.find((tab) => tab.path === path)
  if (!dragged) return
  const others = order.filter((tab) => tab.path !== path)

  const rects = new Map<string, DOMRect>()
  for (const el of row.querySelectorAll<HTMLElement>('[data-repo-tab]')) {
    const key = el.dataset.repoTab
    if (key) rects.set(key, el.getBoundingClientRect())
  }

  let insertIndex = others.length
  for (let index = 0; index < others.length; index += 1) {
    const rect = rects.get(others[index].path)
    if (rect && clientX < rect.left + rect.width / 2) {
      insertIndex = index
      break
    }
  }

  if (insertIndex === order.findIndex((tab) => tab.path === path)) return
  const next = [...others]
  next.splice(insertIndex, 0, dragged)
  dragOrder.value = next
}

function autoScroll(clientX: number): void {
  const row = tabsRow.value
  if (!row) return
  const rect = row.getBoundingClientRect()
  const edge = 32
  if (clientX < rect.left + edge) row.scrollLeft -= 12
  else if (clientX > rect.right - edge) row.scrollLeft += 12
}

function onTabMouseDown(path: string, event: MouseEvent): void {
  if (event.button !== 0) return
  if ((event.target as HTMLElement | null)?.closest('[data-tab-close]')) return

  dragStart = { path, x: event.clientX, y: event.clientY }
  document.addEventListener('mousemove', onTabMouseMove)
  document.addEventListener('mouseup', onTabMouseUp)
}

function onTabMouseMove(event: MouseEvent): void {
  const start = dragStart
  if (!start) return

  if (!draggingPath.value) {
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) return
    draggingPath.value = start.path
    dragOrder.value = tabs.value.map((tab) => ({ ...tab }))
    suppressClick = true
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
  }

  event.preventDefault()
  previewOrder(start.path, event.clientX)
  autoScroll(event.clientX)
}

function onTabMouseUp(): void {
  document.removeEventListener('mousemove', onTabMouseMove)
  document.removeEventListener('mouseup', onTabMouseUp)

  const wasDragging = draggingPath.value != null
  const order = dragOrder.value
  dragStart = null
  draggingPath.value = null
  dragOrder.value = null
  document.body.style.cursor = ''
  document.body.style.userSelect = ''

  if (wasDragging && order) {
    tabsStore.reorderTabs(order.map((tab) => tab.path))
    // Swallow the click browsers emit right after a drag gesture.
    window.setTimeout(() => {
      suppressClick = false
    }, 0)
  }
}

async function selectTab(path: string): Promise<void> {
  if (suppressClick) return
  if (path === activePath.value) return
  try {
    const ok = await repo.switchRepository(path)
    if (!ok) useToastStore().push(`Could not open ${path}.`, 'error')
  } catch (err) {
    console.error('[git-light] switch repository failed:', err)
    useToastStore().push(`Could not open ${path}.`, 'error')
  }
}

async function closeTab(path: string, event: MouseEvent): Promise<void> {
  event.stopPropagation()
  const wasActive = activePath.value === path
  const nextPath = tabsStore.removeTab(path)
  void repo.removeRecent(path)
  if (!wasActive) return
  if (nextPath) {
    await repo.switchRepository(nextPath)
  } else {
    await repo.closeRepository()
  }
}

function openNewRepository(): void {
  void repo.pickAndOpenRepository()
}
</script>

<template>
  <header
    data-tauri-drag-region
    class="app-drag flex shrink-0 items-start border-b border-[var(--color-border)] bg-[var(--color-app)] select-none"
  >
    <div data-tauri-drag-region class="app-drag w-20 shrink-0 self-stretch" aria-hidden="true" />

    <div class="app-no-drag flex min-w-0 items-start gap-1 pr-3">
      <DropdownMenu :items="repoMenu" align="start">
        <IconButton :icon="Folder" label="Repository management" />
      </DropdownMenu>

      <div
        ref="tabsRow"
        class="flex min-w-0 items-start gap-1 overflow-x-auto"
        role="tablist"
        aria-label="Open repositories"
      >
        <button
          v-for="tab in displayTabs"
          :key="tab.path"
          type="button"
          role="tab"
          :aria-selected="tab.path === activePath"
          :title="tab.path"
          :data-repo-tab="tab.path"
          class="app-no-drag focus-ring group relative flex h-8 max-w-[220px] shrink-0 cursor-grab items-center gap-2 rounded-t border px-3 text-xs transition-colors active:cursor-grabbing"
          :class="[
            tab.path === activePath
              ? 'border-[var(--color-border)] border-b-[var(--color-panel)] bg-[var(--color-panel)] text-[var(--color-fg)]'
              : 'border-transparent text-[var(--color-fg-muted)] hover:border-[var(--color-border)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]',
            draggingPath === tab.path ? 'opacity-60' : '',
          ]"
          @click="selectTab(tab.path)"
          @auxclick.prevent="closeTab(tab.path, $event)"
          @pointerenter="preloadTabInBackground(tab.path)"
          @mousedown="onTabMouseDown(tab.path, $event)"
        >
          <span
            v-if="tab.path === activePath"
            class="absolute inset-x-0 top-0 h-px bg-[var(--color-accent)]"
            aria-hidden="true"
          />
          <FolderGit2
            :size="13"
            class="shrink-0"
            :class="tab.path === activePath ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-subtle)]'"
          />
          <span class="truncate font-medium">{{ tab.name }}</span>
          <span
            role="button"
            tabindex="-1"
            data-tab-close
            class="app-no-drag focus-ring flex h-4 w-4 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity group-hover:opacity-100"
            :class="tab.path === activePath ? 'opacity-60 hover:opacity-100' : ''"
            aria-label="Close repository tab"
            @mousedown.stop
            @click="closeTab(tab.path, $event)"
          >
            <X :size="11" />
          </span>
        </button>

        <button
          type="button"
          class="app-no-drag focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
          aria-label="Open repository"
          @click="openNewRepository"
        >
          <Plus :size="14" />
        </button>
      </div>
    </div>

    <div data-tauri-drag-region class="app-drag min-w-8 flex-1 self-stretch" />

    <div class="app-no-drag flex shrink-0 items-start pr-2">
      <AppSettingsMenu />
    </div>
  </header>
</template>
