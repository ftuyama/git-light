<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown, GitCommitHorizontal } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/Button.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import type { MenuItem } from '@/components/ui/menu'
import { useRepositoryStore } from '@/stores/repository'

const repo = useRepositoryStore()
const { t } = useI18n()
const { commitMessage, commitDescription, amend } = storeToRefs(repo)

const commitBusy = computed(
  () =>
    repo.busyAction === 'commit' ||
    repo.busyAction === 'amend' ||
    repo.busyAction === 'commit-and-push' ||
    repo.busyAction === 'commit-and-force-push',
)

const stagedCount = computed(() => repo.stagedFiles.length)

const commitButtonLabel = computed(() =>
  t(amend.value ? 'workingTree.commit.summaryAmend' : 'workingTree.commit.summary', {
    count: stagedCount.value,
  }),
)

const summaryPlaceholder = computed(() =>
  amend.value
    ? t('workingTree.commit.summaryPlaceholderAmend')
    : t('workingTree.commit.summaryPlaceholder'),
)

/** Git convention: keep the subject at or under 72 characters. */
const SUMMARY_MAX_LENGTH = 72
const summaryRemaining = computed(() =>
  Math.max(0, SUMMARY_MAX_LENGTH - commitMessage.value.length),
)

const pushMenu = computed<MenuItem[]>(() => {
  const amendNow = amend.value
  return [
    {
      label: t(amendNow ? 'workingTree.commit.amendAndPush' : 'workingTree.commit.commitAndPush'),
      onSelect: () => repo.commit({ thenPush: true }),
    },
    {
      label: t(
        amendNow
          ? 'workingTree.commit.amendAndForcePush'
          : 'workingTree.commit.commitAndForcePush',
      ),
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
          :title="$t('workingTree.commit.summaryLimit', { count: SUMMARY_MAX_LENGTH })"
        >
          {{ summaryRemaining }}
        </span>
      </div>
      <textarea
        v-model="commitDescription"
        :placeholder="$t('workingTree.commit.descriptionPlaceholder')"
        rows="2"
        spellcheck="false"
        class="w-full resize-none border-t border-[var(--color-border)] bg-transparent px-3 pt-1 pb-3 text-[13px] text-[var(--color-fg-muted)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none"
      />
    </div>

    <label
      class="mt-2 flex items-center gap-2 text-[12px] text-[var(--color-fg-muted)]"
      :title="repo.canAmend ? undefined : $t('workingTree.commit.noCommitsToAmend')"
    >
      <Checkbox
        :model-value="amend"
        :disabled="!repo.canAmend && !amend"
        :aria-label="$t('workingTree.commit.amend')"
        @update:model-value="(value) => repo.setAmend(value)"
      />
      {{ $t('workingTree.commit.amend') }}
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
          :aria-label="$t('workingTree.commit.pushOptions')"
        >
          <ChevronDown :size="16" />
        </button>
      </DropdownMenu>
    </div>
  </div>
</template>
