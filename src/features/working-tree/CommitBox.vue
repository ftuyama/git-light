<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown, ShieldCheck } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import GkButton from '@/components/ui/GkButton.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import Avatar from '@/components/ui/Avatar.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import type { MenuItem } from '@/components/ui/menu'
import { useRepositoryStore } from '@/stores/repository'

const repo = useRepositoryStore()
const { commitMessage, commitDescription, signOff } = storeToRefs(repo)

const author = computed(() => repo.commits[0]?.author)

const pushMenu = computed<MenuItem[]>(() => [
  { label: 'Commit & Push', onSelect: () => repo.commit(true) },
  { label: 'Commit & Force Push', danger: true, onSelect: () => repo.commit(true) },
])
</script>

<template>
  <div class="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-panel)] p-3">
    <div
      class="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-app)] focus-within:border-[var(--color-accent-strong)]"
    >
      <input
        v-model="commitMessage"
        type="text"
        placeholder="Summary (required)"
        spellcheck="false"
        class="w-full bg-transparent px-3 pt-2.5 text-[14px] font-medium text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none"
      />
      <textarea
        v-model="commitDescription"
        placeholder="Description"
        rows="2"
        spellcheck="false"
        class="w-full resize-none bg-transparent px-3 pb-2.5 text-[13px] text-[var(--color-fg-muted)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none"
      />
    </div>

    <div class="mt-2.5 flex items-center gap-2 text-[12px] text-[var(--color-fg-muted)]">
      <Avatar v-if="author" :author="author" :size="18" />
      <span class="truncate">{{ author?.name ?? 'You' }}</span>
      <span
        class="ml-auto flex items-center gap-1 rounded bg-[var(--color-success)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-success)]"
        title="GPG signature verified"
      >
        <ShieldCheck :size="12" /> GPG
      </span>
    </div>

    <label class="mt-2 flex items-center gap-2 text-[12px] text-[var(--color-fg-muted)]">
      <Checkbox
        :model-value="signOff"
        aria-label="Add sign-off"
        @update:model-value="(value) => (signOff = value)"
      />
      Add Signed-off-by trailer
    </label>

    <div class="mt-2.5 flex gap-1.5">
      <GkButton
        variant="primary"
        block
        :disabled="!repo.canCommit"
        :busy="repo.busyAction === 'commit'"
        @click="repo.commit(false)"
      >
        Commit to {{ repo.currentBranch?.name ?? 'branch' }}
      </GkButton>
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
