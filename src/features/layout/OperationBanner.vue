<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, FastForward, GitMerge, RotateCcw, SkipForward, TriangleAlert, X } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import { useRepositoryStore } from '@/stores/repository'

const repo = useRepositoryStore()
const { t } = useI18n()

const label = computed(() => repo.repository?.state?.operationLabel)
const conflictCount = computed(() => repo.conflictedFiles.length)
const canContinue = computed(() => conflictCount.value === 0)
const operationKind = computed<'merge' | 'rebase' | 'cherry-pick' | 'revert' | null>(() => {
  const s = repo.repository?.state
  if (!s) return null
  if (s.merging) return 'merge'
  if (s.rebasing) return 'rebase'
  if (s.cherryPicking) return 'cherry-pick'
  if (s.reverting) return 'revert'
  return null
})
const isBisecting = computed(() => repo.repository?.state?.bisecting ?? false)
const OPERATION_KEYS = {
  merge: 'shell.operation.kindMerge',
  rebase: 'shell.operation.kindRebase',
  'cherry-pick': 'shell.operation.kindCherryPick',
  revert: 'shell.operation.kindRevert',
} as const
const operationName = computed(() => {
  if (isBisecting.value) return t('shell.operation.kindBisect')
  const kind = operationKind.value
  return kind ? t(OPERATION_KEYS[kind]) : ''
})
</script>

<template>
  <div
    v-if="repo.inProgressOperation"
    class="flex shrink-0 items-center gap-3 border-b border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-2 text-sm"
  >
    <GitMerge :size="16" class="shrink-0 text-[var(--color-warning)]" />
    <div class="min-w-0 flex-1">
      <div class="font-medium text-[var(--color-fg)]">
        {{ $t('shell.operation.inProgress', { operation: operationName }) }}
      </div>
      <div v-if="label" class="truncate text-xs text-[var(--color-fg-muted)]">{{ label }}</div>
      <div
        v-if="conflictCount"
        class="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-danger)]"
      >
        <TriangleAlert :size="12" />
        {{ $t('shell.operation.unresolvedConflicts', { count: conflictCount }) }}
      </div>
    </div>
    <div v-if="isBisecting" class="flex items-center gap-2">
      <Button size="sm" variant="secondary" :title="$t('shell.operation.bisectGoodHint')" @click="repo.bisectGood()">
        <Check :size="13" /> {{ $t('shell.operation.bisectGood') }}
      </Button>
      <Button size="sm" variant="secondary" :title="$t('shell.operation.bisectBadHint')" @click="repo.bisectBad()">
        <X :size="13" /> {{ $t('shell.operation.bisectBad') }}
      </Button>
      <Button size="sm" variant="secondary" :title="$t('shell.operation.bisectSkipHint')" @click="repo.bisectSkip()">
        <FastForward :size="13" /> {{ $t('shell.operation.bisectSkip') }}
      </Button>
      <Button size="sm" variant="ghost" :title="$t('shell.operation.bisectResetHint')" @click="repo.bisectReset()">
        <RotateCcw :size="13" /> {{ $t('shell.operation.bisectReset') }}
      </Button>
    </div>
    <div v-else class="flex items-center gap-2">
      <Button
        v-if="operationKind === 'rebase'"
        size="sm"
        variant="secondary"
        :title="$t('shell.operation.skipRebaseHint')"
        @click="repo.skipRebaseOperation()"
      >
        <FastForward :size="13" /> {{ $t('shell.operation.skipRebase') }}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        :disabled="!canContinue"
        :title="canContinue ? undefined : $t('shell.operation.continueBlocked')"
        @click="repo.continueOperation()"
      >
        <SkipForward :size="13" /> {{ $t('shell.operation.continue') }}
      </Button>
      <Button size="sm" variant="ghost" @click="repo.abortOperation()">
        <RotateCcw :size="13" /> {{ $t('shell.operation.abort') }}
      </Button>
    </div>
  </div>
</template>
