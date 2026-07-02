<script setup lang="ts">
import { computed } from 'vue'
import { Copy, ExternalLink, FileX, FolderOpen, GitMerge, History, Minus, Plus, RotateCcw } from '@lucide/vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import type { MenuItem } from '@/components/ui/menu'
import { cn } from '@/lib/utils'
import type { FileListView } from '@/lib/preferences'
import { STATUS_META } from './fileStatus'
import type { WorkingTreeFile } from '@/types/git'
import { useRepositoryStore } from '@/stores/repository'
import { useRepoDiffStore } from '@/stores/repoDiff'
import { useSelectionStore } from '@/stores/selection'
import { useToastStore } from '@/stores/toast'

const props = withDefaults(
  defineProps<{ file: WorkingTreeFile; readonly?: boolean; view?: FileListView }>(),
  { view: 'path' },
)
const repo = useRepositoryStore()
const diffStore = useRepoDiffStore()
const selection = useSelectionStore()
const toast = useToastStore()

const meta = computed(() => STATUS_META[props.file.status])
const selected = computed(
  () => diffStore.selectedFilePath === props.file.path && diffStore.selectedFileStaged === props.file.staged,
)

const menu = computed<MenuItem[]>(() => {
  const historyItem: MenuItem = {
    label: 'View File History',
    icon: History,
    onSelect: () => void diffStore.openFileHistory(props.file.path),
  }

  if (props.readonly) {
    const items: MenuItem[] = [
      { label: 'Reveal in Finder', icon: FolderOpen, onSelect: reveal },
      { label: 'Copy Path', icon: Copy, onSelect: copyPath },
      { label: 'View Diff', icon: ExternalLink, onSelect: () => diffStore.selectFile(props.file.path, { staged: props.file.staged }) },
      historyItem,
    ]
    if (selection.selectedSha) {
      items.push({
        label: 'Restore File from This Version',
        icon: RotateCcw,
        danger: true,
        onSelect: () =>
          void repo.runAction({
            kind: 'restore-file',
            target: props.file.path,
            meta: { sha: selection.selectedSha },
          }),
      })
    }
    return items
  }
  if (props.file.status === 'conflicted') {
    return [
      {
        label: 'Use Ours',
        icon: GitMerge,
        onSelect: () => void repo.resolveConflictOurs(props.file.path),
      },
      {
        label: 'Use Theirs',
        icon: GitMerge,
        onSelect: () => void repo.resolveConflictTheirs(props.file.path),
      },
      {
        label: 'Mark Resolved',
        onSelect: () => void repo.markConflictResolved(props.file.path),
      },
      { separator: true },
      { label: 'Reveal in Finder', icon: FolderOpen, onSelect: reveal },
      { label: 'Copy Path', icon: Copy, onSelect: copyPath },
      {
        label: 'Resolve Conflict',
        icon: ExternalLink,
        onSelect: () => diffStore.selectFile(props.file.path, { staged: props.file.staged }),
      },
    ]
  }
  return [
    {
      label: props.file.staged ? 'Unstage Changes' : 'Stage Changes',
      onSelect: () => repo.toggleStaged(props.file.id),
    },
    {
      label: 'Discard Changes',
      icon: FileX,
      danger: true,
      onSelect: () => void repo.runAction({ kind: 'discard-file', target: props.file.path }),
    },
    { separator: true },
    { label: 'Reveal in Finder', icon: FolderOpen, onSelect: reveal },
    { label: 'Copy Path', icon: Copy, onSelect: copyPath },
    {
      label: 'View Diff',
      icon: ExternalLink,
      onSelect: () => diffStore.selectFile(props.file.path, { staged: props.file.staged }),
    },
    historyItem,
  ]
})

function reveal(): void {
  if (!repo.repository) return
  void repo.runAction({
    kind: 'reveal-in-finder',
    target: `${repo.repository.path}/${props.file.path}`,
  })
}

function copyPath(): void {
  void navigator.clipboard?.writeText(props.file.path)
  toast.push('Copied path to clipboard', 'info')
}
</script>

<template>
  <ContextMenu :items="menu">
    <div
      class="group/file flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 transition-colors hover:bg-[var(--color-hover)]"
      :class="cn(selected && 'bg-[var(--color-accent-soft)]')"
      @click="diffStore.selectFile(file.path, { staged: file.staged })"
    >
      <span
        class="flex size-4 shrink-0 items-center justify-center"
        :style="{ color: meta.color }"
        :title="meta.label"
      >
        <component
          v-if="meta.icon"
          :is="meta.icon"
          :size="10"
          :stroke-width="2.5"
        />
        <template v-else>{{ meta.letter }}</template>
      </span>
      <span
        v-if="view === 'path'"
        class="min-w-0 flex-1 truncate text-[13px] text-[var(--color-fg)]"
      >
        {{ file.path }}
      </span>
      <template v-else>
        <span class="truncate text-[13px] text-[var(--color-fg)]">{{ file.fileName }}</span>
        <span class="min-w-0 flex-1 truncate text-[11px] text-[var(--color-fg-subtle)]">
          {{ file.directory }}
        </span>
      </template>
      <button
        v-if="!readonly && file.status !== 'conflicted'"
        type="button"
        class="focus-ring ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium opacity-0 transition-opacity group-hover/file:opacity-100"
        :class="cn(
          selected && 'opacity-100',
          file.staged
            ? 'text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)]'
            : 'text-[var(--color-success)] hover:bg-[var(--color-success)]/10',
        )"
        :title="file.staged ? 'Unstage file' : 'Stage file'"
        :aria-label="file.staged ? 'Unstage file' : 'Stage file'"
        @click.stop="repo.toggleStaged(file.id)"
      >
        <component :is="file.staged ? Minus : Plus" :size="11" class="inline" />
        {{ file.staged ? 'Unstage' : 'Stage' }}
      </button>
    </div>
  </ContextMenu>
</template>
