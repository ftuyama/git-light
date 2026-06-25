<script setup lang="ts">
import { computed } from 'vue'
import { CheckCheck, ChevronRight, TriangleAlert, X } from '@lucide/vue'
import FileList from './FileList.vue'
import { useRepositoryStore } from '@/stores/repository'
import { useUiStore } from '@/stores/ui'
import CommitBox from './CommitBox.vue'

const repo = useRepositoryStore()
const ui = useUiStore()

const unstaged = computed(() => repo.unstagedFiles)
const staged = computed(() => repo.stagedFiles)
const conflicts = computed(() => repo.conflictedFiles)
</script>

<template>
  <aside class="flex h-full flex-col border-l border-[var(--color-border)] bg-[var(--color-panel)]">
    <!-- Unstaged changes -->
    <div class="flex min-h-0 flex-1 flex-col">
      <header
        class="flex h-9 shrink-0 items-center gap-2 px-3 text-[11px] font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase"
      >
        <span class="flex-1">Changes</span>
        <span class="font-mono text-[10px] text-[var(--color-fg-subtle)]">{{ unstaged.length }}</span>
        <button
          class="focus-ring flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-accent)] normal-case hover:bg-[var(--color-hover)] disabled:opacity-40"
          :disabled="unstaged.length === 0"
          @click="repo.stageAll()"
        >
          <CheckCheck :size="13" /> Stage All
        </button>
      </header>
      <FileList v-if="unstaged.length" :files="unstaged" />
      <div v-else class="flex flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]">
        No unstaged changes
      </div>
    </div>

    <!-- Conflicts -->
    <div class="shrink-0 border-t border-[var(--color-border)]">
      <button
        class="flex h-8 w-full items-center gap-2 px-3 text-[11px] font-semibold tracking-wide uppercase"
        :class="conflicts.length ? 'text-[var(--color-danger)]' : 'text-[var(--color-fg-subtle)]'"
        :disabled="conflicts.length === 0"
        @click="ui.toggleSection('conflicts')"
      >
        <ChevronRight
          v-if="conflicts.length"
          :size="13"
          class="transition-transform"
          :class="ui.isSectionOpen('conflicts') ? 'rotate-90' : ''"
        />
        <TriangleAlert v-else :size="13" />
        <span class="flex-1 text-left">Conflicts</span>
        <span class="font-mono text-[10px]">{{ conflicts.length }}</span>
      </button>
      <div v-if="conflicts.length && ui.isSectionOpen('conflicts')" class="max-h-40 overflow-y-auto px-1 pb-1">
        <FileList :files="conflicts" />
      </div>
    </div>

    <!-- Staged files -->
    <div class="flex max-h-[38%] min-h-0 shrink-0 flex-col border-t border-[var(--color-border)]">
      <header
        class="flex h-9 shrink-0 items-center gap-2 px-3 text-[11px] font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase"
      >
        <span class="flex-1">Staged</span>
        <span class="font-mono text-[10px] text-[var(--color-fg-subtle)]">{{ staged.length }}</span>
        <button
          class="focus-ring flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-fg-muted)] normal-case hover:bg-[var(--color-hover)] disabled:opacity-40"
          :disabled="staged.length === 0"
          @click="repo.unstageAll()"
        >
          <X :size="13" /> Unstage All
        </button>
      </header>
      <FileList v-if="staged.length" :files="staged" />
      <div v-else class="flex h-16 items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]">
        Stage files to commit them
      </div>
    </div>

    <CommitBox />
  </aside>
</template>
