<script setup lang="ts">
import { Folder, FolderGit2, Plus, X } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { useRepoMenu } from '@/features/toolbar/useRepoMenu'
import { useRepositoryStore } from '@/stores/repository'
import { useRepoTabsStore } from '@/stores/repoTabs'

const repo = useRepositoryStore()
const tabsStore = useRepoTabsStore()
const { repoMenu } = useRepoMenu()
const { tabs, activePath } = storeToRefs(tabsStore)

function selectTab(path: string): void {
  if (path === activePath.value) return
  void repo.switchRepository(path)
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
    class="app-drag flex shrink-0 items-start border-b border-[var(--color-border)] bg-[var(--color-app)]"
  >
    <div class="w-20 shrink-0" aria-hidden="true" />

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
          class="focus-ring group relative flex h-8 max-w-[220px] shrink-0 items-center gap-2 rounded-t border px-3 text-xs transition-colors"
          :class="
            tab.path === activePath
              ? 'border-[var(--color-border)] border-b-[var(--color-panel)] bg-[var(--color-panel)] text-[var(--color-fg)]'
              : 'border-transparent text-[var(--color-fg-muted)] hover:border-[var(--color-border)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]'
          "
          @click="selectTab(tab.path)"
          @auxclick.prevent="closeTab(tab.path, $event)"
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
            class="focus-ring flex h-4 w-4 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity group-hover:opacity-100"
            :class="tab.path === activePath ? 'opacity-60 hover:opacity-100' : ''"
            aria-label="Close repository tab"
            @click="closeTab(tab.path, $event)"
          >
            <X :size="11" />
          </span>
        </button>

        <button
          type="button"
          class="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
          aria-label="Open repository"
          @click="openNewRepository"
        >
          <Plus :size="14" />
        </button>
      </div>
    </div>

    <div class="app-drag min-w-8 flex-1 self-stretch" />
  </header>
</template>
