<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, ArrowUp, GitBranch, Loader2, GitCommitHorizontal, FolderGit2 } from '@lucide/vue'
import { useRepositoryStore } from '@/stores/repository'

const repo = useRepositoryStore()

const ahead = computed(() => repo.repository?.ahead ?? 0)
const behind = computed(() => repo.repository?.behind ?? 0)
const stagedCount = computed(() => repo.stagedFiles.length)
const changedCount = computed(() => repo.workingTree.length)
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
      <span v-if="repo.operation" class="flex items-center gap-1.5 text-[var(--color-accent)]">
        <Loader2 :size="12" class="animate-spin" />
        {{ repo.operation }}
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
