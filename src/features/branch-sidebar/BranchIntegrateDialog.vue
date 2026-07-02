<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { GitMerge, Spline } from '@lucide/vue'
import Dialog from '@/components/ui/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import { branchIntegrateLabel } from './useBranchDragDrop'
import { MERGE_MODE_OPTIONS, type MergeMode } from '@/lib/mergeMode'
import { useUiStore } from '@/stores/ui'
import type { Branch } from '@/types/git'

const props = defineProps<{
  open: boolean
  source: Branch | null
  target: Branch | null
}>()

const emit = defineEmits<{
  cancel: []
  merge: [mode: MergeMode]
  rebase: []
}>()

const ui = useUiStore()
const mergeMode = ref<MergeMode>('default')

watch(
  () => props.open,
  (open) => {
    if (open) mergeMode.value = 'default'
  },
)

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
      <div
        class="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-raised)] px-3 py-2.5"
      >
        <div class="flex items-start gap-3">
          <GitMerge :size="16" class="mt-0.5 shrink-0 text-[var(--color-info)]" />
          <div class="min-w-0 flex-1">
            <span class="block text-[13px] font-medium text-[var(--color-fg)]">Merge into target</span>
            <span class="mt-0.5 block text-xs text-[var(--color-fg-subtle)]">
              Merge {{ sourceLabel }} into {{ targetLabel }}
            </span>
            <fieldset class="mt-2.5 space-y-1.5 border-0 p-0">
              <legend class="sr-only">Merge strategy</legend>
              <label
                v-for="option in MERGE_MODE_OPTIONS"
                :key="option.value"
                class="app-no-drag focus-ring flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 transition-colors hover:bg-[var(--color-hover)]"
              >
                <input
                  v-model="mergeMode"
                  type="radio"
                  name="merge-mode"
                  :value="option.value"
                  class="mt-0.5 accent-[var(--color-accent)]"
                />
                <span class="min-w-0">
                  <span class="block text-[12px] font-medium text-[var(--color-fg)]">{{ option.label }}</span>
                  <span class="block text-[11px] text-[var(--color-fg-subtle)]">{{ option.description }}</span>
                </span>
              </label>
            </fieldset>
            <button
              type="button"
              class="app-no-drag focus-ring mt-2 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-active)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-hover)]"
              @click="emit('merge', mergeMode)"
            >
              Merge with selected strategy
            </button>
          </div>
        </div>
      </div>

      <button
        v-if="ui.isAdvanced"
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
