<script setup lang="ts">
import { computed } from 'vue'
import { Copy, ExternalLink, FileX, FolderOpen } from '@lucide/vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import type { MenuItem } from '@/components/ui/menu'
import { cn } from '@/lib/utils'
import { STATUS_META } from './fileStatus'
import type { WorkingTreeFile } from '@/types/git'
import { useRepositoryStore } from '@/stores/repository'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{ file: WorkingTreeFile; readonly?: boolean }>()
const repo = useRepositoryStore()
const toast = useToastStore()

const meta = computed(() => STATUS_META[props.file.status])
const selected = computed(() => repo.selectedFilePath === props.file.path)

const menu = computed<MenuItem[]>(() => {
  if (props.readonly) {
    return [
      { label: 'Reveal in Finder', icon: FolderOpen, onSelect: reveal },
      { label: 'Copy Path', icon: Copy, onSelect: copyPath },
      { label: 'View Diff', icon: ExternalLink, onSelect: () => repo.selectFile(props.file.path) },
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
      onSelect: () => repo.selectFile(props.file.path),
    },
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
      @click="repo.selectFile(file.path)"
    >
      <Checkbox
        v-if="!readonly"
        :model-value="file.staged"
        :aria-label="file.staged ? 'Unstage file' : 'Stage file'"
        @click.stop
        @update:model-value="repo.toggleStaged(file.id)"
      />
      <span
        class="flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-bold"
        :style="{ color: meta.color, backgroundColor: meta.bg }"
        :title="meta.label"
      >
        {{ meta.letter }}
      </span>
      <span class="truncate text-[13px] text-[var(--color-fg)]">{{ file.fileName }}</span>
      <span class="min-w-0 flex-1 truncate text-[11px] text-[var(--color-fg-subtle)]">
        {{ file.directory }}
      </span>
    </div>
  </ContextMenu>
</template>
