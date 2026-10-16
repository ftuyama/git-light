<script setup lang="ts">
import { computed } from 'vue'
import { GitCommitHorizontal, Loader2, Search, Square, Terminal, ZoomIn, ZoomOut } from '@lucide/vue'
import { appVersion } from '@/lib/appVersion'
import { useRepositoryStore } from '@/stores/repository'
import { useGitOutputStore } from '@/stores/gitOutput'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import type { MenuItem } from '@/components/ui/menu'
import {
  useCommitGraphZoom,
  ZOOM_PRESETS,
} from '@/features/commit-graph/composables/useCommitGraphZoom'
import { useUiStore } from '@/stores/ui'
import { formatBindings } from '@/lib/keybindings'

const repo = useRepositoryStore()
const output = useGitOutputStore()
const ui = useUiStore()
const { zoomPercent, canZoomIn, canZoomOut, zoomIn, zoomOut, resetZoom, setZoomPercent } =
  useCommitGraphZoom()

const stagedCount = computed(() => repo.stagedFiles.length)
const changedCount = computed(() => repo.workingTree.length)

const zoomMenuItems = computed<MenuItem[]>(() => [
  { label: 'Zoom in', icon: ZoomIn, shortcut: formatBindings(ui.keybindings.graphZoomIn), disabled: !canZoomIn.value, onSelect: () => zoomIn() },
  { label: 'Zoom out', icon: ZoomOut, shortcut: formatBindings(ui.keybindings.graphZoomOut), disabled: !canZoomOut.value, onSelect: () => zoomOut() },
  { separator: true },
  ...ZOOM_PRESETS.map((preset) => ({
    label: `${preset}%`,
    checked: zoomPercent.value === preset,
    onSelect: () => setZoomPercent(preset),
  })),
  { separator: true },
  { label: 'Reset to 100%', shortcut: formatBindings(ui.keybindings.graphZoomReset), onSelect: () => resetZoom() },
])
</script>

<template>
  <footer
    class="flex h-6 shrink-0 items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-panel)] px-3 text-[11px] text-[var(--color-fg-muted)]"
  >
    <span class="shrink-0 text-[var(--color-fg-subtle)]">v{{ appVersion }}</span>

    <div class="flex-1" />

    <Transition name="fade">
      <span v-if="repo.operation" class="flex max-w-[40%] items-center gap-1.5 truncate text-[var(--color-accent)]">
        <Loader2 :size="12" class="shrink-0 animate-spin" />
        <span class="truncate">{{ repo.operationPhase ?? repo.operation }}</span>
        <button
          v-if="repo.canCancel"
          class="app-no-drag focus-ring ml-1 shrink-0 rounded p-0.5 hover:bg-[var(--color-hover)]"
          title="Cancel operation"
          @click="repo.cancelOperation()"
        >
          <Square :size="10" />
        </button>
      </span>
    </Transition>

    <span class="h-3 w-px bg-[var(--color-border)]" />

    <DropdownMenu :items="zoomMenuItems" side="top" align="center">
      <button
        class="app-no-drag focus-ring flex shrink-0 items-center gap-1 rounded px-1 py-0.5 tabular-nums hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
        title="Select commit graph zoom"
        aria-label="Select commit graph zoom"
      >
        <Search :size="12" class="text-[var(--color-fg-subtle)]" />
        {{ zoomPercent }}%
      </button>
    </DropdownMenu>

    <span class="h-3 w-px bg-[var(--color-border)]" />

    <span class="flex items-center gap-1.5">
      <GitCommitHorizontal :size="12" class="text-[var(--color-fg-subtle)]" />
      {{ repo.commits.length }} commits
    </span>
    <button
      class="app-no-drag focus-ring flex shrink-0 items-center gap-1 rounded px-1 py-0.5 hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
      :class="output.open ? 'text-[var(--color-accent)]' : ''"
      title="Toggle git output (per tab)"
      @click="output.toggle()"
    >
      <Terminal :size="12" />
      Output
    </button>
    <span>{{ stagedCount }} staged · {{ changedCount }} changed</span>
  </footer>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
