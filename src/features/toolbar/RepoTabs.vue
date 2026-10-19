<script setup lang="ts">
import { Folder, FolderGit2, Plus, X } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import IconButton from '@/components/ui/IconButton.vue'
import AppSettingsMenu from '@/features/settings/AppSettingsMenu.vue'
import { useRepoMenu } from '@/features/toolbar/useRepoMenu'
import { useRepositoryStore } from '@/stores/repository'
import { useRepoTabsStore } from '@/stores/repoTabs'
import { preloadTabInBackground } from '@/stores/repo/tabPreload'
import { useToastStore } from '@/stores/toast'

const repo = useRepositoryStore()
const tabsStore = useRepoTabsStore()
const { repoMenu } = useRepoMenu()
const { tabs, activePath } = storeToRefs(tabsStore)

const TAB_DRAG_MIME = 'application/x-git-light-repo-tab'
const draggingPath = ref<string | null>(null)
const dropTarget = ref<{ path: string; position: 'before' | 'after' } | null>(null)
let suppressClick = false

function resetTabDrag(): void {
  draggingPath.value = null
  dropTarget.value = null
  // Swallow the click some browsers emit right after a drag gesture.
  window.setTimeout(() => {
    suppressClick = false
  }, 0)
}

function onTabDragStart(path: string, event: DragEvent): void {
  draggingPath.value = path
  suppressClick = true
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(TAB_DRAG_MIME, path)
  }
}

function onTabDragOver(path: string, event: DragEvent): void {
  if (!draggingPath.value || draggingPath.value === path) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const position = event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
  dropTarget.value = { path, position }
}

function onTabDragLeave(path: string, event: DragEvent): void {
  const current = event.currentTarget as HTMLElement
  const related = event.relatedTarget as Node | null
  if (related && current.contains(related)) return
  if (dropTarget.value?.path === path) dropTarget.value = null
}

function onTabDrop(path: string, event: DragEvent): void {
  event.preventDefault()
  const fromPath = draggingPath.value ?? event.dataTransfer?.getData(TAB_DRAG_MIME) ?? null
  const position = dropTarget.value?.path === path ? dropTarget.value.position : 'before'
  if (fromPath) tabsStore.moveTab(fromPath, path, position)
  resetTabDrag()
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
        class="flex min-w-0 items-start gap-1 overflow-x-auto"
        role="tablist"
        aria-label="Open repositories"
      >
        <button
          v-for="tab in tabs"
          :key="tab.path"
          type="button"
          role="tab"
          :aria-selected="tab.path === activePath"
          :title="tab.path"
          draggable="true"
          class="app-no-drag focus-ring group relative flex h-8 max-w-[220px] shrink-0 items-center gap-2 rounded-t border px-3 text-xs transition-colors"
          :class="[
            tab.path === activePath
              ? 'border-[var(--color-border)] border-b-[var(--color-panel)] bg-[var(--color-panel)] text-[var(--color-fg)]'
              : 'border-transparent text-[var(--color-fg-muted)] hover:border-[var(--color-border)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]',
            draggingPath === tab.path ? 'opacity-50' : '',
          ]"
          @click="selectTab(tab.path)"
          @auxclick.prevent="closeTab(tab.path, $event)"
          @pointerenter="preloadTabInBackground(tab.path)"
          @dragstart="onTabDragStart(tab.path, $event)"
          @dragover="onTabDragOver(tab.path, $event)"
          @dragleave="onTabDragLeave(tab.path, $event)"
          @drop="onTabDrop(tab.path, $event)"
          @dragend="resetTabDrag"
        >
          <span
            v-if="tab.path === activePath"
            class="absolute inset-x-0 top-0 h-px bg-[var(--color-accent)]"
            aria-hidden="true"
          />
          <span
            v-if="dropTarget?.path === tab.path && dropTarget.position === 'before'"
            class="pointer-events-none absolute inset-y-0 -left-px w-0.5 rounded bg-[var(--color-accent)]"
            aria-hidden="true"
          />
          <span
            v-if="dropTarget?.path === tab.path && dropTarget.position === 'after'"
            class="pointer-events-none absolute inset-y-0 -right-px w-0.5 rounded bg-[var(--color-accent)]"
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
            class="app-no-drag focus-ring flex h-4 w-4 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity group-hover:opacity-100"
            :class="tab.path === activePath ? 'opacity-60 hover:opacity-100' : ''"
            aria-label="Close repository tab"
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
