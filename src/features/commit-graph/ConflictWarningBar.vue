<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TriangleAlert } from '@lucide/vue'
import { useRepositoryStore } from '@/stores/repository'
import { useRepoDiffStore } from '@/stores/repoDiff'

type OperationKind = 'merge' | 'rebase' | 'cherry-pick' | 'revert'

const repo = useRepositoryStore()
const diffStore = useRepoDiffStore()
const { t } = useI18n()

const operationKind = computed<OperationKind | null>(() => {
  const state = repo.repository?.state
  if (!state) return null
  if (state.merging) return 'merge'
  if (state.rebasing) return 'rebase'
  if (state.cherryPicking) return 'cherry-pick'
  if (state.reverting) return 'revert'
  return null
})

const visible = computed(
  () => operationKind.value != null && repo.conflictedFiles.length > 0,
)

const targetBranch = computed(
  () => repo.currentBranch?.name ?? repo.repository?.currentBranch ?? 'HEAD',
)

const MESSAGE_KEYS = {
  merge: 'graph.conflictBanner.merge',
  rebase: 'graph.conflictBanner.rebase',
  'cherry-pick': 'graph.conflictBanner.cherryPick',
  revert: 'graph.conflictBanner.revert',
} as const

const message = computed(() => {
  const kind = operationKind.value
  return kind ? t(MESSAGE_KEYS[kind], { target: targetBranch.value }) : ''
})

function openFirstConflict(): void {
  const first = repo.conflictedFiles[0]
  if (first) diffStore.selectFile(first.path, { staged: first.staged })
}
</script>

<template>
  <div
    v-if="visible"
    class="flex shrink-0 items-center gap-2 border-b border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-1.5 text-[12px] text-[var(--color-fg)]"
  >
    <TriangleAlert :size="13" class="shrink-0 text-[var(--color-warning)]" />
    <button class="focus-ring min-w-0 flex-1 truncate text-left hover:underline" @click="openFirstConflict">
      {{ message }}
    </button>
    <span class="shrink-0 font-mono text-[10px] text-[var(--color-fg-muted)]">
      {{ $t('common.count.conflicts', { count: repo.conflictedFiles.length }) }}
    </span>
  </div>
</template>
