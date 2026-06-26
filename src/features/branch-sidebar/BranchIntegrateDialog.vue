<script setup lang="ts">
import { computed } from 'vue'
import { GitMerge, Spline } from '@lucide/vue'
import Dialog from '@/components/ui/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import { branchIntegrateLabel } from './useBranchDragDrop'
import type { Branch } from '@/types/git'

const props = defineProps<{
  open: boolean
  source: Branch | null
  target: Branch | null
}>()

const emit = defineEmits<{
  cancel: []
  merge: []
  rebase: []
}>()

const sourceLabel = computed(() => (props.source ? branchIntegrateLabel(props.source) : ''))
const targetLabel = computed(() => (props.target ? branchIntegrateLabel(props.target) : ''))
</script>

<template>
  <Dialog :open="open" title="Integrate branches" @cancel="emit('cancel')">
    <p class="text-sm text-[var(--color-fg-muted)]">
      Choose how to integrate
      <span class="font-medium text-[var(--color-fg)]">{{ sourceLabel }}</span>
      with
      <span class="font-medium text-[var(--color-fg)]">{{ targetLabel }}</span>.
    </p>

    <div class="grid gap-2 pt-1">
      <button
        type="button"
        class="app-no-drag focus-ring flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-raised)] px-3 py-2.5 text-left transition-colors hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-hover)]"
        @click="emit('merge')"
      >
        <GitMerge :size="16" class="mt-0.5 shrink-0 text-[var(--color-info)]" />
        <span>
          <span class="block text-[13px] font-medium text-[var(--color-fg)]">Merge into target</span>
          <span class="mt-0.5 block text-xs text-[var(--color-fg-subtle)]">
            Merge {{ sourceLabel }} into {{ targetLabel }}
          </span>
        </span>
      </button>
      <button
        type="button"
        class="app-no-drag focus-ring flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-raised)] px-3 py-2.5 text-left transition-colors hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-hover)]"
        @click="emit('rebase')"
      >
        <Spline :size="16" class="mt-0.5 shrink-0 text-[var(--color-warning)]" />
        <span>
          <span class="block text-[13px] font-medium text-[var(--color-fg)]">Rebase onto target</span>
          <span class="mt-0.5 block text-xs text-[var(--color-fg-subtle)]">
            Rebase {{ sourceLabel }} onto {{ targetLabel }}
          </span>
        </span>
      </button>
    </div>

    <template #footer>
      <Button variant="ghost" @click="emit('cancel')">Cancel</Button>
    </template>
  </Dialog>
</template>
