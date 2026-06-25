<script setup lang="ts">
import { computed } from 'vue'
import { formatDistanceToNow } from 'date-fns'
import { FolderGit2, FolderOpen, Loader2, Trash2 } from '@lucide/vue'
import iconUrl from '@/assets/icon.png'
import { useRepositoryStore } from '@/stores/repository'

const repo = useRepositoryStore()

const sortedRecent = computed(() =>
  [...repo.recentRepos].sort((a, b) => b.lastOpened - a.lastOpened),
)

function openRecent(path: string): void {
  void repo.openRepository(path)
}

function removeRecent(path: string, event: Event): void {
  event.stopPropagation()
  void repo.removeRecent(path)
}
</script>

<template>
  <div
    class="flex h-screen w-screen flex-col items-center justify-center bg-[var(--color-app)] px-6"
  >
    <div class="w-full max-w-lg">
      <div class="mb-10 text-center">
        <img
          :src="iconUrl"
          alt=""
          width="64"
          height="64"
          class="mx-auto mb-4 h-16 w-16 rounded-2xl"
        />
        <h1 class="text-2xl font-semibold tracking-tight text-[var(--color-fg)]">Git Light</h1>
        <p class="mt-2 text-sm text-[var(--color-fg-muted)]">
          Open a local repository to browse history, branches, and changes.
        </p>
      </div>

      <button
        class="focus-ring flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        :disabled="repo.loading"
        @click="repo.pickAndOpenRepository()"
      >
        <Loader2 v-if="repo.loading" :size="18" class="animate-spin" />
        <FolderOpen v-else :size="18" />
        Open Repository…
      </button>

      <section v-if="sortedRecent.length > 0" class="mt-10">
        <h2 class="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
          Recent
        </h2>
        <ul class="divide-y divide-[var(--color-border)] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]">
          <li
            v-for="item in sortedRecent"
            :key="item.path"
            class="group flex items-center transition-colors hover:bg-[var(--color-hover)]"
          >
            <button
              class="focus-ring flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
              :disabled="repo.loading"
              @click="openRecent(item.path)"
            >
              <FolderGit2 :size="18" class="shrink-0 text-[var(--color-accent)]" />
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-[var(--color-fg)]">{{ item.name }}</div>
                <div class="truncate text-xs text-[var(--color-fg-subtle)]">{{ item.path }}</div>
              </div>
              <span class="shrink-0 text-xs text-[var(--color-fg-subtle)]">
                {{ formatDistanceToNow(item.lastOpened, { addSuffix: true }) }}
              </span>
            </button>
            <button
              class="app-no-drag focus-ring mr-2 shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-[var(--color-panel-raised)] group-hover:opacity-100"
              title="Remove from recent"
              :disabled="repo.loading"
              @click="removeRecent(item.path, $event)"
            >
              <Trash2 :size="14" class="text-[var(--color-fg-subtle)]" />
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
