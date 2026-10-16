<script setup lang="ts">
import { computed } from 'vue'
import {
  ArchiveRestore,
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Check,
  ChevronDown,
  Cherry,
  CloudDownload,
  Command,
  FolderGit2,
  GitBranch,
  GitMerge,
  Inbox,
  ListTree,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  RotateCw,
  Redo2,
  Undo2,
  Search,
  Spline,
  Terminal,
  Workflow,
} from '@lucide/vue'
import IconButton from '@/components/ui/IconButton.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import { useRepoMenu } from '@/features/toolbar/useRepoMenu'
import type { MenuItem } from '@/components/ui/menu'
import { useRepositoryStore } from '@/stores/repository'
import { useInteractiveRebaseStore } from '@/stores/interactiveRebase'
import { useSelectionStore } from '@/stores/selection'
import { useUiStore } from '@/stores/ui'
import type { GitActionKind } from '@/types/git'
import { formatBindings } from '@/lib/keybindings'

const repo = useRepositoryStore()
const { repoMenu } = useRepoMenu()
const selection = useSelectionStore()
const interactiveRebase = useInteractiveRebaseStore()
const ui = useUiStore()

const undoShortcut = computed(() => formatBindings(ui.keybindings.undo))
const redoShortcut = computed(() => formatBindings(ui.keybindings.redo))
const pullShortcut = computed(() => formatBindings(ui.keybindings.pull))
const pushShortcut = computed(() => formatBindings(ui.keybindings.push))
const paletteShortcut = computed(() => formatBindings(ui.keybindings.commandPalette))
const searchShortcut = computed(() => formatBindings(ui.keybindings.globalSearch))
const terminalShortcut = computed(() => formatBindings(ui.keybindings.openTerminal))
const refreshShortcut = computed(() => formatBindings(ui.keybindings.refresh))

function run(kind: GitActionKind, target?: string): void {
  void repo.runAction({ kind, target })
}

const isBusy = (kind: GitActionKind): boolean => repo.busyAction === kind

const branchSwitching = computed(() => repo.branchSwitching)

const branchMenu = computed<MenuItem[]>(() =>
  repo.localBranches.slice(0, 8).map((branch) => ({
    label: branch.name,
    icon: branch.isCurrent ? Check : GitBranch,
    onSelect: () => repo.checkoutBranch(branch.name),
  })),
)

const remoteMenu = computed<MenuItem[]>(() => {
  const items: MenuItem[] = [{ label: 'Fetch', icon: CloudDownload, onSelect: () => run('fetch') }]
  if (ui.isAdvanced) {
    items.push({ label: 'Sync', icon: ArrowDownUp, onSelect: () => run('sync') })
  }
  items.push(
    { separator: true },
    { label: 'Fetch All', icon: CloudDownload, onSelect: () => run('fetch-all') },
    { label: 'Prune Stale Remotes', onSelect: () => run('prune') },
    { label: 'Push Tags', onSelect: () => run('push-tags') },
  )
  return items
})

const mergeMenu = computed<MenuItem[]>(() => [
  { label: 'Merge', icon: GitMerge, onSelect: () => repo.mergeBranch() },
  {
    label: 'Squash merge',
    icon: GitMerge,
    shortcut: '--squash',
    onSelect: () => repo.mergeBranch('squash'),
  },
])

const workflowMenu = computed<MenuItem[]>(() => [
  {
    label: 'Start Bisect…',
    disabled: repo.inProgressOperation,
    onSelect: () => void repo.startBisect(),
  },
  { separator: true },
  { label: 'Track with Git LFS…', onSelect: () => void repo.lfsTrack() },
  { label: 'Untrack from Git LFS…', onSelect: () => void repo.lfsUntrack() },
  { label: 'Prune Git LFS Objects', onSelect: () => void repo.lfsPrune() },
])

const moreMenu = computed<MenuItem[]>(() => {
  const items: MenuItem[] = []
  if (ui.isAdvanced) {
    items.push({
      label: 'Cherry Pick',
      icon: Cherry,
      onSelect: () => repo.cherryPickCommit(selection.selectedSha ?? undefined),
    })
  }
  items.push({ label: 'Merge', icon: GitMerge, children: mergeMenu.value })
  if (ui.isAdvanced) {
    items.push({ label: 'Rebase', icon: Spline, onSelect: () => repo.rebaseOnto() })
    items.push({
      label: 'Interactive Rebase',
      icon: ListTree,
      onSelect: () => interactiveRebase.open(),
    })
    items.push({ label: 'Bisect and LFS', icon: Workflow, children: workflowMenu.value })
  }
  items.push({ separator: true })
  items.push({ label: 'Reset…', icon: RotateCcw, onSelect: () => repo.resetTo('reset-mixed') })
  return items
})
</script>

<template>
  <header
    data-tauri-drag-region
    class="app-drag flex h-14 shrink-0 items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-panel)] pl-2 pr-2 select-none"
  >
    <div class="app-no-drag flex shrink-0 items-center gap-2">
      <DropdownMenu :items="repoMenu" align="start">
        <button
          class="app-no-drag focus-ring flex h-8 max-w-[200px] items-center gap-1.5 rounded-md px-2 text-[13px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
          :title="repo.repository?.path"
        >
          <FolderGit2 :size="15" class="shrink-0 text-[var(--color-accent)]" />
          <span class="truncate font-medium text-[var(--color-fg)]">
            {{ repo.repository?.name ?? 'Repository' }}
          </span>
          <ChevronDown :size="14" class="shrink-0 text-[var(--color-fg-subtle)]" />
        </button>
      </DropdownMenu>

      <div class="h-5 w-px bg-[var(--color-border)]" />

      <DropdownMenu :items="branchMenu" align="start">
        <button
          class="app-no-drag focus-ring flex h-8 items-center gap-2 rounded-md px-2 text-[13px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
          :disabled="branchSwitching"
        >
          <Loader2 v-if="branchSwitching" :size="15" class="animate-spin" />
          <GitBranch v-else :size="15" />
          <span class="font-medium text-[var(--color-fg)]">
            {{ repo.currentBranch?.name ?? '—' }}
          </span>
          <ChevronDown :size="14" class="text-[var(--color-fg-subtle)]" />
        </button>
      </DropdownMenu>
    </div>

    <div data-tauri-drag-region class="app-drag min-w-2 flex-1 self-stretch" />

    <div class="app-no-drag flex shrink-0 items-center gap-0.5">
      <IconButton
        caption="Undo"
        :icon="Undo2"
        :label="repo.undoTooltip"
        :shortcut="undoShortcut"
        :disabled="!repo.canUndo"
        :busy="isBusy('undo')"
        @click="run('undo')"
      />
      <IconButton
        caption="Redo"
        :icon="Redo2"
        :label="repo.redoTooltip"
        :shortcut="redoShortcut"
        :disabled="!repo.canRedo"
        :busy="isBusy('redo')"
        @click="run('redo')"
      />

      <div class="mx-1 h-6 w-px bg-[var(--color-border)]" />

      <IconButton caption="Pull" :icon="ArrowDown" label="Pull" :shortcut="pullShortcut" :busy="isBusy('pull')" @click="run('pull')" />
      <IconButton caption="Push" :icon="ArrowUp" label="Push" :shortcut="pushShortcut" :busy="isBusy('push')" @click="run('push')" />
      <DropdownMenu :items="remoteMenu" align="start">
        <IconButton caption="Remote" :icon="MoreHorizontal" label="More remote actions" />
      </DropdownMenu>

      <div class="mx-1 h-6 w-px bg-[var(--color-border)]" />

      <template v-if="ui.isAdvanced">
        <IconButton caption="Stash" :icon="Inbox" label="Stash" @click="repo.stashChanges()" />
        <IconButton caption="Pop" :icon="ArchiveRestore" label="Pop Stash" @click="run('pop-stash')" />
        <div class="mx-1 h-6 w-px bg-[var(--color-border)]" />
      </template>

      <DropdownMenu :items="moreMenu" align="end">
        <IconButton caption="More" :icon="MoreHorizontal" label="More actions" />
      </DropdownMenu>
    </div>

    <div data-tauri-drag-region class="app-drag min-w-2 flex-1 self-stretch" />

    <div class="app-no-drag flex shrink-0 items-center gap-0.5">
      <IconButton caption="Cmd" :icon="Command" label="Command palette" :shortcut="paletteShortcut" @click="ui.toggleCommandPalette()" />
      <IconButton caption="Search" :icon="Search" label="Search" :shortcut="searchShortcut" @click="repo.openSearch()" />
      <IconButton
        v-if="ui.isAdvanced"
        caption="Term"
        :icon="Terminal"
        label="Open Terminal"
        :shortcut="terminalShortcut"
        @click="run('open-terminal')"
      />
      <IconButton caption="Refresh" :icon="RotateCw" label="Refresh" :shortcut="refreshShortcut" :busy="isBusy('refresh')" @click="run('refresh')" />
    </div>
  </header>
</template>
