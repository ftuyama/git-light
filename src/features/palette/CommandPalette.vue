<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { CornerDownLeft, Search, X } from '@lucide/vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import { filterCommands, type PaletteCommand } from '@/lib/commands'
import { useInteractiveRebaseStore } from '@/stores/interactiveRebase'
import { useRepositoryStore } from '@/stores/repository'
import { useUiStore } from '@/stores/ui'

const repo = useRepositoryStore()
const ui = useUiStore()
const interactiveRebase = useInteractiveRebaseStore()

const query = ref('')
const activeIndex = ref(0)
const inputRef = ref<InstanceType<typeof SearchInput> | null>(null)

const open = computed(() => ui.commandPaletteOpen)

const allCommands = computed<PaletteCommand[]>(() => {
  const commands: PaletteCommand[] = [
    { id: 'fetch', title: 'Fetch', keywords: 'download remote update', run: () => repo.runAction({ kind: 'fetch' }) },
    { id: 'fetch-all', title: 'Fetch All (prune)', keywords: 'download remote update prune', run: () => repo.runAction({ kind: 'fetch-all' }) },
    { id: 'pull', title: 'Pull', keywords: 'download merge fast-forward', run: () => repo.runAction({ kind: 'pull' }) },
    { id: 'push', title: 'Push', keywords: 'upload remote publish', run: () => repo.runAction({ kind: 'push' }) },
    { id: 'push-tags', title: 'Push Tags', keywords: 'upload remote publish tags', run: () => repo.runAction({ kind: 'push-tags' }) },
    { id: 'prune', title: 'Prune Stale Remotes', keywords: 'clean remote prune', run: () => repo.runAction({ kind: 'prune' }) },
    { id: 'sync', title: 'Sync (fetch + pull)', keywords: 'download update', run: () => repo.runAction({ kind: 'sync' }) },
    { id: 'refresh', title: 'Refresh', keywords: 'reload update status', run: () => repo.runAction({ kind: 'refresh' }) },
    { id: 'stash', title: 'Stash Changes', keywords: 'save wip shelf', run: () => repo.stashChanges() },
    { id: 'pop-stash', title: 'Pop Stash', keywords: 'restore apply unshelve', run: () => repo.runAction({ kind: 'pop-stash' }) },
    { id: 'merge', title: 'Merge Branch…', keywords: 'integrate join', run: () => repo.mergeBranch() },
    { id: 'rebase', title: 'Rebase Onto…', keywords: 'integrate replay move', run: () => repo.rebaseOnto() },
    { id: 'interactive-rebase', title: 'Interactive Rebase…', keywords: 'rewrite squash edit history', run: () => interactiveRebase.open() },
    { id: 'cherry-pick', title: 'Cherry Pick Commit…', keywords: 'copy apply commit', run: () => repo.cherryPickCommit() },
    { id: 'create-branch', title: 'Create Branch…', keywords: 'new checkout', run: () => repo.createBranch() },
    { id: 'create-tag', title: 'Create Tag…', keywords: 'new release version', run: () => repo.createTag() },
    { id: 'bisect', title: 'Start Bisect…', keywords: 'debug find regression binary search', run: () => repo.startBisect() },
    { id: 'lfs-track', title: 'Track with Git LFS…', keywords: 'large files binary', run: () => repo.lfsTrack() },
    { id: 'lfs-untrack', title: 'Untrack Git LFS…', keywords: 'large files binary remove', run: () => repo.lfsUntrack() },
    { id: 'lfs-prune', title: 'Prune Git LFS Objects', keywords: 'large files binary clean', run: () => repo.lfsPrune() },
    { id: 'stage-all', title: 'Stage All Changes', keywords: 'add index', run: () => repo.runAction({ kind: 'stage-all' }) },
    { id: 'search', title: 'Search Commits and Files…', keywords: 'find grep', run: () => repo.openSearch() },
    { id: 'terminal', title: 'Open System Terminal', keywords: 'shell cli console', run: () => repo.runAction({ kind: 'open-terminal' }) },
    { id: 'sidebar-left', title: 'Toggle Left Sidebar', keywords: 'branches panel view', run: () => ui.toggleLeft() },
    { id: 'sidebar-right', title: 'Toggle Right Sidebar', keywords: 'working tree panel view', run: () => ui.toggleRight() },
    { id: 'settings', title: 'Open Settings…', keywords: 'preferences appearance theme', run: () => ui.openSettings() },
  ]
  if (repo.canUndo) {
    commands.push({ id: 'undo', title: repo.undoTooltip, keywords: 'revert back', run: () => repo.runAction({ kind: 'undo' }) })
  }
  if (repo.canRedo) {
    commands.push({ id: 'redo', title: repo.redoTooltip, keywords: 'reapply forward', run: () => repo.runAction({ kind: 'redo' }) })
  }
  for (const branch of repo.localBranches.slice(0, 8)) {
    commands.push({
      id: `checkout:${branch.name}`,
      title: `Checkout ${branch.name}`,
      keywords: 'branch switch',
      run: () => repo.checkoutBranch(branch.name),
    })
  }
  return commands
})

const results = computed(() => filterCommands(allCommands.value, query.value))

watch(open, (isOpen) => {
  query.value = ''
  activeIndex.value = 0
  if (isOpen) void nextTick(() => inputRef.value?.focus())
})

watch(results, () => {
  activeIndex.value = 0
})

function runCommand(command: PaletteCommand): void {
  ui.closeCommandPalette()
  void command.run()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    ui.closeCommandPalette()
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (results.value.length) activeIndex.value = (activeIndex.value + 1) % results.value.length
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (results.value.length) {
      activeIndex.value = (activeIndex.value - 1 + results.value.length) % results.value.length
    }
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    const command = results.value[activeIndex.value]
    if (command) runCommand(command)
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[190] flex items-start justify-center bg-black/50 p-6 pt-[12vh] backdrop-blur-[1px]"
      @click.self="ui.closeCommandPalette()"
      @keydown="onKeydown"
    >
      <div
        class="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-panel)] shadow-2xl"
        role="dialog"
        aria-label="Command palette"
      >
        <div class="flex items-center gap-2 border-b border-[var(--color-border)] p-3">
          <Search :size="18" class="shrink-0 text-[var(--color-fg-subtle)]" />
          <SearchInput
            ref="inputRef"
            v-model="query"
            class="flex-1"
            placeholder="Type a command or branch…"
          />
          <button
            class="focus-ring rounded p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]"
            @click="ui.closeCommandPalette()"
          >
            <X :size="16" />
          </button>
        </div>

        <div class="max-h-[50vh] overflow-y-auto p-2">
          <button
            v-for="(command, index) in results"
            :key="command.id"
            class="focus-ring flex w-full items-center gap-2 rounded-md px-2 py-2 text-left"
            :class="index === activeIndex ? 'bg-[var(--color-hover)]' : 'hover:bg-[var(--color-hover)]'"
            @click="runCommand(command)"
            @mousemove="activeIndex = index"
          >
            <CornerDownLeft :size="14" class="shrink-0 text-[var(--color-fg-subtle)]" />
            <span class="truncate text-sm text-[var(--color-fg)]">{{ command.title }}</span>
            <span v-if="command.hint" class="ml-auto shrink-0 text-[11px] text-[var(--color-fg-subtle)]">
              {{ command.hint }}
            </span>
          </button>
          <div v-if="!results.length" class="py-8 text-center text-sm text-[var(--color-fg-subtle)]">
            No matching commands.
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
