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
  RotateCcw,
  RotateCw,
  Redo2,
  Search,
  Settings,
  Spline,
  Terminal,
  Undo2,
} from '@lucide/vue'
import GkIconButton from '@/components/ui/GkIconButton.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import type { MenuItem } from '@/components/ui/menu'
import { useRepositoryStore } from '@/stores/repository'
import type { GitActionKind } from '@/types/git'

const repo = useRepositoryStore()

function run(kind: GitActionKind, target?: string): void {
  void repo.runAction({ kind, target })
}

const isBusy = (kind: GitActionKind): boolean => repo.busyAction === kind

const repoMenu = computed<MenuItem[]>(() => [
  { label: 'AwesomeShop', icon: FolderGit2, onSelect: () => {} },
  { label: 'design-system', icon: FolderGit2, onSelect: () => {} },
  { label: 'infra-terraform', icon: FolderGit2, onSelect: () => {} },
  { separator: true },
  { label: 'Open Repository…', onSelect: () => {} },
  { label: 'Clone Repository…', onSelect: () => {} },
])

const branchMenu = computed<MenuItem[]>(() =>
  repo.localBranches.slice(0, 8).map((branch) => ({
    label: branch.name,
    icon: branch.isCurrent ? Check : GitBranch,
    onSelect: () => repo.checkoutBranch(branch.name),
  })),
)
</script>

<template>
  <header
    class="app-drag flex h-12 shrink-0 items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-panel)] px-2"
  >
    <div class="w-[68px] shrink-0" />

    <!-- Repository selector -->
    <DropdownMenu :items="repoMenu" align="start">
      <button
        class="app-no-drag focus-ring flex h-8 items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-panel-raised)] px-2.5 text-[13px] font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-hover)]"
      >
        <FolderGit2 :size="15" class="text-[var(--color-accent)]" />
        {{ repo.repository?.name ?? 'Repository' }}
        <ChevronDown :size="14" class="text-[var(--color-fg-subtle)]" />
      </button>
    </DropdownMenu>

    <!-- Current branch -->
    <DropdownMenu :items="branchMenu" align="start">
      <button
        class="app-no-drag focus-ring flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
      >
        <GitBranch :size="15" />
        <span class="font-medium text-[var(--color-fg)]">
          {{ repo.currentBranch?.name ?? 'main' }}
        </span>
        <ChevronDown :size="14" class="text-[var(--color-fg-subtle)]" />
      </button>
    </DropdownMenu>

    <div class="mx-1 h-6 w-px bg-[var(--color-border)]" />

    <!-- Remote operations -->
    <div class="flex items-center gap-0.5">
      <GkIconButton :icon="CloudDownload" label="Fetch" :busy="isBusy('fetch')" @click="run('fetch')" />
      <GkIconButton :icon="ArrowDown" label="Pull" shortcut="⌘⇧L" :busy="isBusy('pull')" @click="run('pull')" />
      <GkIconButton :icon="ArrowUp" label="Push" shortcut="⌘⇧P" :busy="isBusy('push')" @click="run('push')" />
      <GkIconButton :icon="ArrowDownUp" label="Sync" :busy="isBusy('sync')" @click="run('sync')" />
    </div>

    <div class="mx-1 h-6 w-px bg-[var(--color-border)]" />

    <!-- Stash -->
    <div class="flex items-center gap-0.5">
      <GkIconButton :icon="Inbox" label="Stash" @click="run('stash')" />
      <GkIconButton :icon="ArchiveRestore" label="Pop Stash" @click="run('pop-stash')" />
    </div>

    <div class="mx-1 h-6 w-px bg-[var(--color-border)]" />

    <!-- History operations -->
    <div class="flex items-center gap-0.5">
      <GkIconButton :icon="Cherry" label="Cherry Pick" @click="run('cherry-pick')" />
      <GkIconButton :icon="GitMerge" label="Merge" @click="run('merge')" />
      <GkIconButton :icon="Spline" label="Rebase" @click="run('rebase')" />
      <GkIconButton :icon="ListTree" label="Interactive Rebase" @click="run('interactive-rebase')" />
      <GkIconButton :icon="RotateCcw" label="Reset" @click="run('reset-mixed')" />
    </div>

    <div class="mx-1 h-6 w-px bg-[var(--color-border)]" />

    <!-- Undo / redo -->
    <div class="flex items-center gap-0.5">
      <GkIconButton :icon="Undo2" label="Undo" shortcut="⌘Z" @click="run('undo')" />
      <GkIconButton :icon="Redo2" label="Redo" shortcut="⌘⇧Z" @click="run('redo')" />
    </div>

    <div class="app-drag flex-1" />

    <!-- Right cluster -->
    <div class="flex items-center gap-0.5">
      <GkIconButton :icon="Search" label="Search Commits" shortcut="⌘F" @click="run('refresh')" />
      <GkIconButton :icon="Terminal" label="Open Terminal" shortcut="⌘T" @click="run('open-terminal')" />
      <GkIconButton :icon="RotateCw" label="Refresh" shortcut="⌘R" :busy="isBusy('refresh')" @click="run('refresh')" />
      <GkIconButton :icon="Settings" label="Settings (coming soon)" disabled />
    </div>
  </header>
</template>
