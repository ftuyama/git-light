<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, ArrowUp, GitBranch, GitCommitHorizontal, FolderGit2, Loader2, Square } from '@lucide/vue'
import { useRepositoryStore } from '@/stores/repository'

const repo = useRepositoryStore()

const ahead = computed(() => repo.repository?.ahead ?? 0)
const behind = computed(() => repo.repository?.behind ?? 0)
const stagedCount = computed(() => repo.stagedFiles.length)
const changedCount = computed(() => repo.workingTree.length)
const remoteUrl = computed(() => repo.repository?.remoteUrl)
</script>

<template>
  <footer
    class="flex h-6 shrink-0 items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-panel)] px-3 text-[11px] text-[var(--color-fg-muted)]"
  >
    <span class="flex items-center gap-1.5">
      <FolderGit2 :size="12" class="text-[var(--color-fg-subtle)]" />
      {{ repo.repository?.name ?? '—' }}
    </span>
    <span class="text-[var(--color-fg-subtle)]">git {{ repo.repository?.gitVersion ?? '—' }}</span>
    <span v-if="remoteUrl" class="hidden max-w-[200px] truncate text-[var(--color-fg-subtle)] xl:inline" :title="remoteUrl">
      {{ remoteUrl }}
    </span>

    <span class="h-3 w-px bg-[var(--color-border)]" />

    <span class="flex items-center gap-1.5">
      <GitBranch :size="12" />
      {{ repo.currentBranch?.name ?? '—' }}
    </span>
    <span class="flex items-center gap-1.5 font-mono">
      <span class="flex items-center"><ArrowUp :size="11" />{{ ahead }}</span>
      <span class="flex items-center"><ArrowDown :size="11" />{{ behind }}</span>
    </span>

    <div class="flex-1" />

    <Transition name="fade">
      <span v-if="repo.operation" class="flex max-w-[40%] items-center gap-1.5 truncate text-[var(--color-accent)]">
        <Loader2 :size="12" class="shrink-0 animate-spin" />
        <span class="truncate">{{ repo.operationPhase ?? repo.operation }}</span>
        <button
          v-if="repo.canCancel"
          class="app-no-drag focus-ring ml-1 shrink-0 rounded p-0.5 hover:bg-[var(--color-hover)]"
          title="Cancel operation"
          @click="repo.cancelOperation()"
        >
          <Square :size="10" />
        </button>
      </span>
    </Transition>

    <span class="h-3 w-px bg-[var(--color-border)]" />

    <span class="flex items-center gap-1.5">
      <GitCommitHorizontal :size="12" class="text-[var(--color-fg-subtle)]" />
      {{ repo.commits.length }} commits
    </span>
    <span>{{ stagedCount }} staged · {{ changedCount }} changed</span>
  </footer>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
