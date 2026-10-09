<script setup lang="ts">
import { computed } from 'vue'
import { Check, FastForward, GitMerge, RotateCcw, SkipForward, TriangleAlert, X } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import { useRepositoryStore } from '@/stores/repository'

const repo = useRepositoryStore()

const label = computed(() => repo.repository?.state?.operationLabel)
const conflictCount = computed(() => repo.conflictedFiles.length)
const canContinue = computed(() => conflictCount.value === 0)
const operation = computed(() => {
  const s = repo.repository?.state
  if (!s) return null
  if (s.merging) return 'merge'
  if (s.rebasing) return 'rebase'
  if (s.cherryPicking) return 'cherry-pick'
  if (s.reverting) return 'revert'
  return null
})
const isBisecting = computed(() => repo.repository?.state?.bisecting ?? false)
</script>

<template>
  <div
    v-if="repo.inProgressOperation"
    class="flex shrink-0 items-center gap-3 border-b border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-2 text-sm"
  >
    <GitMerge :size="16" class="shrink-0 text-[var(--color-warning)]" />
    <div class="min-w-0 flex-1">
      <div class="font-medium text-[var(--color-fg)]">
        {{ isBisecting ? 'bisect' : operation }} in progress
      </div>
      <div v-if="label" class="truncate text-xs text-[var(--color-fg-muted)]">{{ label }}</div>
      <div
        v-if="conflictCount"
        class="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-danger)]"
      >
        <TriangleAlert :size="12" />
        {{ conflictCount }} unresolved conflict{{ conflictCount === 1 ? '' : 's' }}
      </div>
    </div>
    <div v-if="isBisecting" class="flex items-center gap-2">
      <Button size="sm" variant="secondary" title="Mark the current commit as good" @click="repo.bisectGood()">
        <Check :size="13" /> Good
      </Button>
      <Button size="sm" variant="secondary" title="Mark the current commit as bad" @click="repo.bisectBad()">
        <X :size="13" /> Bad
      </Button>
      <Button size="sm" variant="secondary" title="Skip the current commit" @click="repo.bisectSkip()">
        <FastForward :size="13" /> Skip
      </Button>
      <Button size="sm" variant="ghost" title="End the bisect session" @click="repo.bisectReset()">
        <RotateCcw :size="13" /> Reset
      </Button>
    </div>
    <div v-else class="flex items-center gap-2">
      <Button
        v-if="operation === 'rebase'"
        size="sm"
        variant="secondary"
        title="Skip the current commit and continue the rebase"
        @click="repo.skipRebaseOperation()"
      >
        <FastForward :size="13" /> Skip
      </Button>
      <Button
        size="sm"
        variant="secondary"
        :disabled="!canContinue"
        :title="canContinue ? undefined : 'Resolve all conflicts before continuing'"
        @click="repo.continueOperation()"
      >
        <SkipForward :size="13" /> Continue
      </Button>
      <Button size="sm" variant="ghost" @click="repo.abortOperation()">
        <RotateCcw :size="13" /> Abort
      </Button>
    </div>
  </div>
</template>
