<script setup lang="ts">
import { computed } from 'vue'
import { GitMerge, RotateCcw, SkipForward } from '@lucide/vue'
import GkButton from '@/components/ui/GkButton.vue'
import { useRepositoryStore } from '@/stores/repository'

const repo = useRepositoryStore()

const label = computed(() => repo.repository?.state?.operationLabel)
const operation = computed(() => {
  const s = repo.repository?.state
  if (!s) return null
  if (s.merging) return 'merge'
  if (s.rebasing) return 'rebase'
  if (s.cherryPicking) return 'cherry-pick'
  if (s.reverting) return 'revert'
  return null
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
        {{ operation }} in progress
      </div>
      <div v-if="label" class="truncate text-xs text-[var(--color-fg-muted)]">{{ label }}</div>
    </div>
    <div class="flex items-center gap-2">
      <GkButton size="sm" variant="secondary" @click="repo.continueOperation()">
        <SkipForward :size="13" /> Continue
      </GkButton>
      <GkButton size="sm" variant="ghost" @click="repo.abortOperation()">
        <RotateCcw :size="13" /> Abort
      </GkButton>
    </div>
  </div>
</template>
