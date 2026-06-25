<script setup lang="ts">
import { computed } from 'vue'
import { Copy, FileX, Minus, Plus } from '@lucide/vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import type { MenuItem } from '@/components/ui/menu'
import { STATUS_META } from './fileStatus'
import type { WorkingTreeFile } from '@/types/git'
import { useRepositoryStore } from '@/stores/repository'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{ file: WorkingTreeFile }>()
const repo = useRepositoryStore()
const toast = useToastStore()

const meta = computed(() => STATUS_META[props.file.status])

const menu = computed<MenuItem[]>(() => [
  {
    label: props.file.staged ? 'Unstage Changes' : 'Stage Changes',
    onSelect: () => repo.toggleStaged(props.file.id),
  },
  { label: 'Discard Changes', icon: FileX, danger: true, onSelect: discard },
  { separator: true },
  { label: 'Copy Path', icon: Copy, onSelect: copyPath },
])

function discard(): void {
  toast.push(`Discarded changes in ${props.file.fileName}`, 'info')
}
function copyPath(): void {
  void navigator.clipboard?.writeText(props.file.path)
  toast.push('Copied path to clipboard', 'info')
}
</script>

<template>
  <ContextMenu :items="menu">
    <div
      class="group/file flex h-7 items-center gap-2 rounded-md px-2 transition-colors hover:bg-[var(--color-hover)]"
    >
      <Checkbox
        :model-value="file.staged"
        :aria-label="file.staged ? 'Unstage file' : 'Stage file'"
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
      <span
        v-if="file.additions || file.deletions"
        class="flex shrink-0 items-center gap-1 font-mono text-[10px]"
      >
        <span v-if="file.additions" class="flex items-center text-[var(--color-success)]">
          <Plus :size="9" />{{ file.additions }}
        </span>
        <span v-if="file.deletions" class="flex items-center text-[var(--color-danger)]">
          <Minus :size="9" />{{ file.deletions }}
        </span>
      </span>
    </div>
  </ContextMenu>
</template>
