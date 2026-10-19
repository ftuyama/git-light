<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown, GitCommitHorizontal } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import Button from '@/components/ui/Button.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import type { MenuItem } from '@/components/ui/menu'
import { useRepositoryStore } from '@/stores/repository'

const repo = useRepositoryStore()
const { commitMessage, commitDescription, amend } = storeToRefs(repo)

const commitBusy = computed(
  () =>
    repo.busyAction === 'commit' ||
    repo.busyAction === 'amend' ||
    repo.busyAction === 'commit-and-push' ||
    repo.busyAction === 'commit-and-force-push',
)

const stagedCount = computed(() => repo.stagedFiles.length)

const commitButtonLabel = computed(() => {
  const fileLabel = stagedCount.value === 1 ? 'File' : 'Files'
  const prefix = amend.value ? 'Amend Changes to' : 'Commit Changes to'
  return `${prefix} ${stagedCount.value} ${fileLabel}`
})

const summaryPlaceholder = computed(() =>
  amend.value ? 'Commit Summary (empty keeps previous message)' : 'Commit Summary',
)

/** Git convention: keep the subject at or under 72 characters. */
const SUMMARY_MAX_LENGTH = 72
const summaryRemaining = computed(() =>
  Math.max(0, SUMMARY_MAX_LENGTH - commitMessage.value.length),
)

const pushMenu = computed<MenuItem[]>(() => {
  const verb = amend.value ? 'Amend' : 'Commit'
  return [
    { label: `${verb} & Push`, onSelect: () => repo.commit({ thenPush: true }) },
    {
      label: `${verb} & Force Push (with lease)`,
      shortcut: '--force-with-lease',
      danger: true,
      onSelect: () => repo.commit({ thenPush: true, forcePush: true }),
    },
  ]
})
</script>

<template>
  <div class="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-panel)] p-3">
    <div
      class="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-app)] focus-within:border-[var(--color-accent-strong)]"
    >
      <div class="relative">
        <input
          v-model="commitMessage"
          type="text"
          :placeholder="summaryPlaceholder"
          :maxlength="SUMMARY_MAX_LENGTH"
          spellcheck="false"
          class="w-full bg-transparent px-3 pt-2.5 pb-2 pr-10 text-[14px] font-medium text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none"
        />
        <span
          class="pointer-events-none absolute top-2.5 right-3 text-[11px] tabular-nums text-[var(--color-fg-subtle)]"
          :title="`Up to ${SUMMARY_MAX_LENGTH} characters`"
        >
          {{ summaryRemaining }}
        </span>
      </div>
      <textarea
        v-model="commitDescription"
        placeholder="Description"
        rows="2"
        spellcheck="false"
        class="w-full resize-none border-t border-[var(--color-border)] bg-transparent px-3 pt-1 pb-3 text-[13px] text-[var(--color-fg-muted)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none"
      />
    </div>

    <label
      class="mt-2 flex items-center gap-2 text-[12px] text-[var(--color-fg-muted)]"
      :title="repo.canAmend ? undefined : 'No commits to amend yet'"
    >
      <Checkbox
        :model-value="amend"
        :disabled="!repo.canAmend && !amend"
        aria-label="Amend previous commit"
        @update:model-value="(value) => repo.setAmend(value)"
      />
      Amend previous commit
    </label>

    <div class="mt-2.5 flex gap-1.5">
      <Button
        variant="primary"
        block
        :icon="GitCommitHorizontal"
        :disabled="!repo.canCommit"
        :busy="commitBusy"
        @click="repo.commit()"
      >
        {{ commitButtonLabel }}
      </Button>
      <DropdownMenu :items="pushMenu" align="end" side="top">
        <button
          class="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-accent-strong)] text-white transition-colors hover:bg-[var(--color-accent)] disabled:opacity-40"
          :disabled="!repo.canCommit"
          aria-label="Commit and push options"
        >
          <ChevronDown :size="16" />
        </button>
      </DropdownMenu>
    </div>
  </div>
</template>
