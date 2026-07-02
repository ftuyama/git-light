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
  FolderGit2,
  FolderOpen,
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
} from '@lucide/vue'
import IconButton from '@/components/ui/IconButton.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import AppSettingsMenu from '@/features/settings/AppSettingsMenu.vue'
import type { MenuItem } from '@/components/ui/menu'
import { useRepositoryStore } from '@/stores/repository'
import { useInteractiveRebaseStore } from '@/stores/interactiveRebase'
import { useSelectionStore } from '@/stores/selection'
import { useUiStore } from '@/stores/ui'
import type { GitActionKind } from '@/types/git'

const repo = useRepositoryStore()
const selection = useSelectionStore()
const interactiveRebase = useInteractiveRebaseStore()
const ui = useUiStore()

function run(kind: GitActionKind, target?: string): void {
  void repo.runAction({ kind, target })
}

const isBusy = (kind: GitActionKind): boolean => repo.busyAction === kind

const branchSwitching = computed(() => repo.branchSwitching)

const repoMenu = computed<MenuItem[]>(() => {
  const items: MenuItem[] = repo.recentRepos.slice(0, 8).map((r) => ({
    label: r.name,
    icon: FolderGit2,
    onSelect: () => void repo.openRepository(r.path),
  }))
  if (items.length > 0) items.push({ separator: true })
  items.push(
    { label: 'Open Repository…', icon: FolderOpen, onSelect: () => void repo.pickAndOpenRepository() },
    { label: 'Close Repository', onSelect: () => void repo.closeRepository() },
  )
  return items
})

const branchMenu = computed<MenuItem[]>(() =>
  repo.localBranches.slice(0, 8).map((branch) => ({
    label: branch.name,
    icon: branch.isCurrent ? Check : GitBranch,
    onSelect: () => repo.checkoutBranch(branch.name),
  })),
)

const remoteMenu = computed<MenuItem[]>(() => [
  { label: 'Fetch All', icon: CloudDownload, onSelect: () => run('fetch-all') },
  { label: 'Prune Stale Remotes', onSelect: () => run('prune') },
  { label: 'Push Tags', onSelect: () => run('push-tags') },
])
</script>

<template>
  <header
    class="app-drag flex h-12 shrink-0 items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-panel)] px-2"
  >
    <div class="w-[68px] shrink-0" />

    <DropdownMenu :items="repoMenu" align="start">
      <button
        class="app-no-drag focus-ring flex h-8 items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-panel-raised)] px-2.5 text-[13px] font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-hover)]"
      >
        <FolderGit2 :size="15" class="text-[var(--color-accent)]" />
        {{ repo.repository?.name ?? 'Repository' }}
        <ChevronDown :size="14" class="text-[var(--color-fg-subtle)]" />
      </button>
    </DropdownMenu>

    <DropdownMenu :items="branchMenu" align="start">
      <button
        class="app-no-drag focus-ring flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
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

    <div class="mx-1 h-6 w-px bg-[var(--color-border)]" />

    <div class="flex items-center gap-0.5">
      <IconButton :icon="CloudDownload" label="Fetch" :busy="isBusy('fetch')" @click="run('fetch')" />
      <IconButton :icon="ArrowDown" label="Pull" shortcut="⌘⇧L" :busy="isBusy('pull')" @click="run('pull')" />
      <IconButton :icon="ArrowUp" label="Push" shortcut="⌘⇧P" :busy="isBusy('push')" @click="run('push')" />
      <IconButton :icon="ArrowDownUp" label="Sync" :busy="isBusy('sync')" @click="run('sync')" />
      <DropdownMenu :items="remoteMenu" align="start">
        <IconButton :icon="MoreHorizontal" label="More remote actions" />
      </DropdownMenu>
    </div>

    <div class="mx-1 h-6 w-px bg-[var(--color-border)]" />

    <template v-if="ui.isAdvanced">
      <div class="flex items-center gap-0.5">
        <IconButton :icon="Inbox" label="Stash" @click="repo.stashChanges()" />
        <IconButton :icon="ArchiveRestore" label="Pop Stash" @click="run('pop-stash')" />
      </div>

      <div class="mx-1 h-6 w-px bg-[var(--color-border)]" />
    </template>

    <div class="flex items-center gap-0.5">
      <IconButton
        v-if="ui.isAdvanced"
        :icon="Cherry"
        label="Cherry Pick"
        @click="repo.cherryPickCommit(selection.selectedSha ?? undefined)"
      />
      <IconButton :icon="GitMerge" label="Merge" @click="repo.mergeBranch()" />
      <template v-if="ui.isAdvanced">
        <IconButton :icon="Spline" label="Rebase" @click="repo.rebaseOnto()" />
        <IconButton :icon="ListTree" label="Interactive Rebase" @click="interactiveRebase.open()" />
      </template>
      <IconButton :icon="RotateCcw" label="Reset" @click="repo.resetTo('reset-mixed')" />
    </div>

    <div class="mx-1 h-6 w-px bg-[var(--color-border)]" />

    <div class="app-drag flex-1" />

    <div class="flex items-center gap-0.5">
      <IconButton
        :icon="Undo2"
        :label="repo.undoTooltip"
        shortcut="⌘Z"
        :disabled="!repo.canUndo"
        :busy="isBusy('undo')"
        @click="run('undo')"
      />
      <IconButton
        :icon="Redo2"
        :label="repo.redoTooltip"
        shortcut="⌘⇧Z"
        :disabled="!repo.canRedo"
        :busy="isBusy('redo')"
        @click="run('redo')"
      />
      <IconButton :icon="Search" label="Search" shortcut="⌘⇧F" @click="repo.openSearch()" />
      <IconButton
        v-if="ui.isAdvanced"
        :icon="Terminal"
        label="Toggle Terminal"
        shortcut="⌘T"
        @click="run('open-terminal')"
      />
      <IconButton :icon="RotateCw" label="Refresh" shortcut="⌘R" :busy="isBusy('refresh')" @click="run('refresh')" />
      <AppSettingsMenu />
    </div>
  </header>
</template>
