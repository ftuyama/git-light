<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
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
const { t } = useI18n()

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
  const items: MenuItem[] = []
  if (ui.isAdvanced) {
    items.push(
      { label: t('shell.toolbar.sync'), icon: ArrowDownUp, onSelect: () => run('sync') },
      { separator: true },
    )
  }
  items.push(
    { label: t('shell.toolbar.fetchAll'), icon: CloudDownload, onSelect: () => run('fetch-all') },
    { label: t('shell.toolbar.pruneRemotes'), onSelect: () => run('prune') },
    { label: t('shell.toolbar.pushTags'), onSelect: () => run('push-tags') },
  )
  return items
})

const mergeMenu = computed<MenuItem[]>(() => [
  { label: t('shell.toolbar.merge'), icon: GitMerge, onSelect: () => repo.mergeBranch() },
  {
    label: t('shell.toolbar.squashMerge'),
    icon: GitMerge,
    shortcut: '--squash',
    onSelect: () => repo.mergeBranch('squash'),
  },
])

const workflowMenu = computed<MenuItem[]>(() => [
  {
    label: t('shell.toolbar.startBisect'),
    disabled: repo.inProgressOperation,
    onSelect: () => void repo.startBisect(),
  },
  { separator: true },
  { label: t('shell.toolbar.lfsTrack'), onSelect: () => void repo.lfsTrack() },
  { label: t('shell.toolbar.lfsUntrack'), onSelect: () => void repo.lfsUntrack() },
  { label: t('shell.toolbar.lfsPrune'), onSelect: () => void repo.lfsPrune() },
])

const moreMenu = computed<MenuItem[]>(() => {
  const items: MenuItem[] = []
  if (ui.isAdvanced) {
    items.push({
      label: t('shell.toolbar.cherryPick'),
      icon: Cherry,
      onSelect: () => repo.cherryPickCommit(selection.selectedSha ?? undefined),
    })
  }
  items.push({ label: t('shell.toolbar.merge'), icon: GitMerge, children: mergeMenu.value })
  if (ui.isAdvanced) {
    items.push({ label: t('shell.toolbar.rebase'), icon: Spline, onSelect: () => repo.rebaseOnto() })
    items.push({
      label: t('shell.toolbar.interactiveRebase'),
      icon: ListTree,
      onSelect: () => interactiveRebase.open(),
    })
    items.push({ label: t('shell.toolbar.bisectAndLfs'), icon: Workflow, children: workflowMenu.value })
  }
  items.push({ separator: true })
  items.push({ label: t('shell.toolbar.reset'), icon: RotateCcw, onSelect: () => repo.resetTo('reset-mixed') })
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
            {{ repo.repository?.name ?? $t('common.labels.repository') }}
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
        :caption="$t('shell.toolbar.undo')"
        :icon="Undo2"
        :label="repo.undoTooltip"
        :shortcut="undoShortcut"
        :disabled="!repo.canUndo"
        :busy="isBusy('undo')"
        @click="run('undo')"
      />
      <IconButton
        :caption="$t('shell.toolbar.redo')"
        :icon="Redo2"
        :label="repo.redoTooltip"
        :shortcut="redoShortcut"
        :disabled="!repo.canRedo"
        :busy="isBusy('redo')"
        @click="run('redo')"
      />

      <div class="mx-1 h-6 w-px bg-[var(--color-border)]" />

      <IconButton :caption="$t('shell.toolbar.pull')" :icon="ArrowDown" :label="$t('shell.toolbar.pull')" :shortcut="pullShortcut" :busy="isBusy('pull')" @click="run('pull')" />
      <IconButton :caption="$t('shell.toolbar.push')" :icon="ArrowUp" :label="$t('shell.toolbar.push')" :shortcut="pushShortcut" :busy="isBusy('push')" @click="run('push')" />
      <IconButton :caption="$t('shell.toolbar.fetch')" :icon="CloudDownload" :label="$t('shell.toolbar.fetch')" :busy="isBusy('fetch')" @click="run('fetch')" />
      <DropdownMenu :items="remoteMenu" align="start">
        <IconButton :caption="$t('shell.toolbar.captionRemote')" :icon="MoreHorizontal" :label="$t('shell.toolbar.moreRemote')" />
      </DropdownMenu>

      <div class="mx-1 h-6 w-px bg-[var(--color-border)]" />

      <template v-if="ui.isAdvanced">
        <IconButton :caption="$t('shell.toolbar.stash')" :icon="Inbox" :label="$t('shell.toolbar.stash')" @click="repo.stashChanges()" />
        <IconButton :caption="$t('shell.toolbar.popStash')" :icon="ArchiveRestore" :label="$t('shell.toolbar.popStash')" @click="run('pop-stash')" />
        <div class="mx-1 h-6 w-px bg-[var(--color-border)]" />
      </template>

      <DropdownMenu :items="moreMenu" align="end">
        <IconButton :caption="$t('shell.toolbar.more')" :icon="MoreHorizontal" :label="$t('shell.toolbar.more')" />
      </DropdownMenu>
    </div>

    <div data-tauri-drag-region class="app-drag min-w-2 flex-1 self-stretch" />

    <div class="app-no-drag flex shrink-0 items-center gap-0.5">
      <IconButton :caption="$t('shell.toolbar.captionCommand')" :icon="Command" :label="$t('shell.toolbar.commandPalette')" :shortcut="paletteShortcut" @click="ui.toggleCommandPalette()" />
      <IconButton :caption="$t('shell.toolbar.search')" :icon="Search" :label="$t('shell.toolbar.search')" :shortcut="searchShortcut" @click="repo.openSearch()" />
      <IconButton
        v-if="ui.isAdvanced"
        :caption="$t('shell.toolbar.captionTerminal')"
        :icon="Terminal"
        :label="$t('shell.toolbar.openTerminal')"
        :shortcut="terminalShortcut"
        @click="run('open-terminal')"
      />
      <IconButton :caption="$t('shell.toolbar.refresh')" :icon="RotateCw" :label="$t('shell.toolbar.refresh')" :shortcut="refreshShortcut" :busy="isBusy('refresh')" @click="run('refresh')" />
    </div>
  </header>
</template>
