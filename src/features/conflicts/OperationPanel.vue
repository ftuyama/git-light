<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, FastForward, RotateCcw, SkipForward, TriangleAlert, X } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import FileList from '@/features/working-tree/FileList.vue'
import FileListViewToggle from '@/features/working-tree/FileListViewToggle.vue'
import { useRepositoryStore } from '@/stores/repository'

type OperationKind = 'merge' | 'rebase' | 'cherry-pick' | 'revert' | 'bisect'

const repo = useRepositoryStore()
const { t } = useI18n()

const operationState = computed(() => repo.repository?.state)
const conflicts = computed(() => repo.conflictedFiles)
const conflictCount = computed(() => conflicts.value.length)
const canContinue = computed(() => conflictCount.value === 0)
const busy = computed(() => Boolean(repo.busyAction))

const operationKind = computed<OperationKind | null>(() => {
  const state = operationState.value
  if (!state) return null
  if (state.merging) return 'merge'
  if (state.rebasing) return 'rebase'
  if (state.cherryPicking) return 'cherry-pick'
  if (state.reverting) return 'revert'
  if (state.bisecting) return 'bisect'
  return null
})
const isBisecting = computed(() => operationKind.value === 'bisect')

const TITLE_KEYS = {
  merge: 'conflicts.panel.mergeTitle',
  rebase: 'conflicts.panel.rebaseTitle',
  'cherry-pick': 'conflicts.panel.cherryPickTitle',
  revert: 'conflicts.panel.revertTitle',
  bisect: 'conflicts.panel.bisectTitle',
} as const

const title = computed(() => {
  const kind = operationKind.value
  if (!kind) return ''
  if (kind !== 'bisect' && conflictCount.value === 0) {
    return t('conflicts.panel.noConflictsTitle')
  }
  return t(TITLE_KEYS[kind])
})

const targetBranch = computed(
  () => repo.currentBranch?.name ?? repo.repository?.currentBranch ?? 'HEAD',
)
const source = computed(() => operationState.value?.operationSource ?? null)

const subtitle = computed(() => {
  const kind = operationKind.value
  const target = targetBranch.value
  const from = source.value
  if (kind === 'merge') {
    return from
      ? t('conflicts.panel.mergingInto', { source: from, target })
      : t('conflicts.panel.mergingFallback', { target })
  }
  if (kind === 'rebase') {
    return from
      ? t('conflicts.panel.rebasingSource', { source: from })
      : t('conflicts.panel.rebasingFallback')
  }
  if (kind === 'cherry-pick') {
    return from
      ? t('conflicts.panel.cherryPickingOnto', { source: from, target })
      : t('conflicts.panel.cherryPickingFallback', { target })
  }
  if (kind === 'revert') {
    return from
      ? t('conflicts.panel.revertingOnto', { source: from, target })
      : t('conflicts.panel.revertingFallback', { target })
  }
  if (kind === 'bisect') return t('conflicts.panel.bisectHint')
  return ''
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="shrink-0 border-b border-[var(--color-border)] px-3 py-3">
      <div class="flex items-start gap-2.5">
        <div
          class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-warning)]/15 text-[var(--color-warning)]"
        >
          <TriangleAlert :size="15" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[13px] font-semibold text-[var(--color-fg)]">{{ title }}</p>
          <p class="mt-0.5 text-[11px] leading-4 break-words text-[var(--color-fg-muted)]">
            {{ subtitle }}
          </p>
        </div>
      </div>

      <div class="mt-3 flex items-center justify-between gap-2">
        <span class="text-[11px] font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase">
          {{ $t('workingTree.headers.conflicts', { count: conflictCount }) }}
        </span>
        <FileListViewToggle with-labels />
      </div>
    </div>

    <FileList v-if="conflictCount" :files="conflicts" />
    <div
      v-else
      class="flex flex-1 items-center justify-center px-5 text-center text-xs text-[var(--color-fg-subtle)]"
    >
      {{ isBisecting ? $t('conflicts.panel.bisectEmpty') : $t('conflicts.panel.noConflicts') }}
    </div>

    <div class="flex shrink-0 flex-col gap-2 border-t border-[var(--color-border)] p-2.5">
      <template v-if="isBisecting">
        <div class="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="secondary"
            :title="$t('shell.operation.bisectGoodHint')"
            :disabled="busy"
            @click="repo.bisectGood()"
          >
            <Check :size="13" /> {{ $t('shell.operation.bisectGood') }}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            :title="$t('shell.operation.bisectBadHint')"
            :disabled="busy"
            @click="repo.bisectBad()"
          >
            <X :size="13" /> {{ $t('shell.operation.bisectBad') }}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            :title="$t('shell.operation.bisectSkipHint')"
            :disabled="busy"
            @click="repo.bisectSkip()"
          >
            <FastForward :size="13" /> {{ $t('shell.operation.bisectSkip') }}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            :title="$t('shell.operation.bisectResetHint')"
            :disabled="busy"
            @click="repo.bisectReset()"
          >
            <RotateCcw :size="13" /> {{ $t('shell.operation.bisectReset') }}
          </Button>
        </div>
      </template>

      <template v-else>
        <p
          v-if="!canContinue"
          class="flex items-center gap-1.5 text-[11px] leading-4 text-[var(--color-fg-muted)]"
        >
          <TriangleAlert :size="12" class="shrink-0 text-[var(--color-warning)]" />
          {{ $t('conflicts.panel.resolveToContinue') }}
        </p>
        <div class="flex items-center gap-2">
          <Button
            v-if="operationKind === 'rebase'"
            size="sm"
            variant="secondary"
            :title="$t('shell.operation.skipRebaseHint')"
            :disabled="busy"
            @click="repo.skipRebaseOperation()"
          >
            <FastForward :size="13" /> {{ $t('shell.operation.skipRebase') }}
          </Button>
          <Button
            variant="primary"
            class="flex-1"
            :disabled="!canContinue || busy"
            :title="canContinue ? undefined : $t('shell.operation.continueBlocked')"
            @click="repo.continueOperation()"
          >
            <SkipForward :size="14" /> {{ $t('shell.operation.continue') }}
          </Button>
        </div>
        <Button variant="ghost" size="sm" :disabled="busy" @click="repo.abortOperation()">
          <RotateCcw :size="13" /> {{ $t('shell.operation.abort') }}
        </Button>
      </template>
    </div>
  </div>
</template>
