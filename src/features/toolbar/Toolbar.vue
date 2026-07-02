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
import { useRepoMenu } from '@/features/toolbar/useRepoMenu'
import type { MenuItem } from '@/components/ui/menu'
import { useRepositoryStore } from '@/stores/repository'
import { useInteractiveRebaseStore } from '@/stores/interactiveRebase'
import { useSelectionStore } from '@/stores/selection'
import { useUiStore } from '@/stores/ui'
import type { GitActionKind } from '@/types/git'

const repo = useRepositoryStore()
const { repoMenu } = useRepoMenu()
const selection = useSelectionStore()
const interactiveRebase = useInteractiveRebaseStore()
const ui = useUiStore()

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

const remoteMenu = computed<MenuItem[]>(() => [
  { label: 'Fetch All', icon: CloudDownload, onSelect: () => run('fetch-all') },
  { label: 'Prune Stale Remotes', onSelect: () => run('prune') },
  { label: 'Push Tags', onSelect: () => run('push-tags') },
])
</script>

<template>
  <header
    class="app-drag flex h-12 shrink-0 items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-panel)] pl-2 pr-2"
  >
    <div class="app-no-drag flex shrink-0 items-center gap-2">
      <DropdownMenu :items="repoMenu" align="start">
        <button
          class="focus-ring flex h-8 max-w-[200px] items-center gap-1.5 rounded-md px-2 text-[13px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
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
          class="focus-ring flex h-8 items-center gap-2 rounded-md px-2 text-[13px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
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

    <div class="app-drag min-w-2 flex-1" />

    <div class="app-no-drag flex shrink-0 items-center gap-0.5">
      <IconButton :icon="CloudDownload" label="Fetch" :busy="isBusy('fetch')" @click="run('fetch')" />
      <IconButton :icon="ArrowDown" label="Pull" shortcut="⌘⇧L" :busy="isBusy('pull')" @click="run('pull')" />
      <IconButton :icon="ArrowUp" label="Push" shortcut="⌘⇧P" :busy="isBusy('push')" @click="run('push')" />
      <template v-if="ui.isAdvanced">
        <IconButton :icon="ArrowDownUp" label="Sync" :busy="isBusy('sync')" @click="run('sync')" />
        <DropdownMenu :items="remoteMenu" align="start">
          <IconButton :icon="MoreHorizontal" label="More remote actions" />
        </DropdownMenu>
      </template>

      <div class="mx-1 h-6 w-px bg-[var(--color-border)]" />

      <template v-if="ui.isAdvanced">
        <IconButton :icon="Inbox" label="Stash" @click="repo.stashChanges()" />
        <IconButton :icon="ArchiveRestore" label="Pop Stash" @click="run('pop-stash')" />
        <div class="mx-1 h-6 w-px bg-[var(--color-border)]" />
      </template>

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

    <div class="app-drag min-w-2 flex-1" />

    <div class="app-no-drag flex shrink-0 items-center gap-0.5">
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
