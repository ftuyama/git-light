<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatDistanceToNow } from 'date-fns'
import { FolderGit2, FolderOpen, FolderSearch, GitFork, Loader2, Plus, Trash2 } from '@lucide/vue'
import { open } from '@tauri-apps/plugin-dialog'
import { storeToRefs } from 'pinia'
import type { DiscoveredRepo } from '@shared/git/models'
import iconUrl from '@/assets/icon.png'
import AppSettingsMenu from '@/features/settings/AppSettingsMenu.vue'
import UiModePicker from '@/features/settings/UiModePicker.vue'
import CloneDialog from './CloneDialog.vue'
import InitDialog from './InitDialog.vue'
import { useRepositoryStore } from '@/stores/repository'
import { useUiStore } from '@/stores/ui'

const repo = useRepositoryStore()
const ui = useUiStore()
const { uiMode } = storeToRefs(ui)

const cloneOpen = ref(false)
const initOpen = ref(false)
const scanning = ref(false)
const scannedRoot = ref('')
const discovered = ref<DiscoveredRepo[]>([])
const scanRan = ref(false)

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

async function submitClone(payload: { url: string; parentPath: string; name: string }): Promise<void> {
  const ok = await repo.cloneRepository({
    url: payload.url,
    parentPath: payload.parentPath,
    name: payload.name || undefined,
  })
  if (ok) cloneOpen.value = false
}

async function submitInit(payload: { path: string; defaultBranch: string }): Promise<void> {
  const ok = await repo.initRepository({
    path: payload.path,
    defaultBranch: payload.defaultBranch || undefined,
  })
  if (ok) initOpen.value = false
}

async function scanFolder(): Promise<void> {
  let root: string | null = null
  try {
    const picked = await open({ directory: true, multiple: false })
    if (typeof picked !== 'string') return
    root = picked
  } catch (err) {
    console.error('[git-light] folder pick failed:', err)
    return
  }
  scanning.value = true
  scanRan.value = false
  try {
    discovered.value = await repo.discoverRepositories(root)
    scannedRoot.value = root
    scanRan.value = true
    // A single hit opens directly; multiple hits offer a choice.
    if (discovered.value.length === 1 && discovered.value[0]) {
      await repo.openRepository(discovered.value[0].path)
    }
  } finally {
    scanning.value = false
  }
}
</script>

<template>
  <div
    class="relative flex h-screen w-screen flex-col items-center justify-center bg-[var(--color-app)] px-6"
  >
    <div data-tauri-drag-region class="app-drag absolute inset-x-0 top-0 h-12" aria-hidden="true" />
    <div class="app-no-drag absolute top-3 right-3">
      <AppSettingsMenu />
    </div>

    <div class="w-full max-w-lg">
      <div class="mb-10 text-center">
        <img
          :src="iconUrl"
          alt=""
          width="64"
          height="64"
          class="mx-auto mb-4 h-16 w-16"
        />
        <h1 class="text-2xl font-semibold tracking-tight text-[var(--color-fg)]">Git Light</h1>
        <p class="mt-2 text-sm text-[var(--color-fg-muted)]">
          Open a local repository to browse history, branches, and changes.
        </p>
      </div>

      <section class="mb-6">
        <h2 class="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
          Interface
        </h2>
        <p class="mb-3 text-xs text-[var(--color-fg-muted)]">
          Choose how much of Git Light to show. You can change this later in settings.
        </p>
        <UiModePicker :model-value="uiMode" compact />
      </section>

      <button
        class="focus-ring flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        :disabled="repo.loading"
        @click="repo.pickAndOpenRepository()"
      >
        <Loader2 v-if="repo.loading" :size="18" class="animate-spin" />
        <FolderOpen v-else :size="18" />
        Open Repository…
      </button>

      <div class="mt-3 grid grid-cols-2 gap-3">
        <button
          class="focus-ring flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-panel)] px-4 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-hover)] disabled:opacity-60"
          :disabled="repo.loading"
          @click="cloneOpen = true"
        >
          <GitFork :size="16" />
          Clone…
        </button>
        <button
          class="focus-ring flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-panel)] px-4 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-hover)] disabled:opacity-60"
          :disabled="repo.loading"
          @click="initOpen = true"
        >
          <Plus :size="16" />
          New…
        </button>
      </div>

      <button
        class="focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)] disabled:opacity-60"
        :disabled="scanning || repo.loading"
        @click="scanFolder"
      >
        <Loader2 v-if="scanning" :size="14" class="animate-spin" />
        <FolderSearch v-else :size="14" />
        {{ scanning ? 'Scanning…' : 'Look for repositories in a folder…' }}
      </button>

      <section v-if="scanRan && discovered.length > 1" class="mt-6">
        <h2 class="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
          Found in {{ scannedRoot }}
        </h2>
        <ul class="divide-y divide-[var(--color-border)] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]">
          <li
            v-for="item in discovered"
            :key="item.path"
            class="transition-colors hover:bg-[var(--color-hover)]"
          >
            <button
              class="focus-ring flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left w-full"
              :disabled="repo.loading"
              @click="openRecent(item.path)"
            >
              <FolderGit2 :size="18" class="shrink-0 text-[var(--color-accent)]" />
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-[var(--color-fg)]">{{ item.name }}</div>
                <div class="truncate text-xs text-[var(--color-fg-subtle)]">{{ item.path }}</div>
              </div>
            </button>
          </li>
        </ul>
      </section>
      <p v-else-if="scanRan && discovered.length === 0" class="mt-6 text-center text-xs text-[var(--color-fg-muted)]">
        No repositories found in {{ scannedRoot }}.
      </p>

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

    <CloneDialog
      :open="cloneOpen"
      :busy="repo.loading"
      @close="cloneOpen = false"
      @submit="submitClone"
    />
    <InitDialog
      :open="initOpen"
      :busy="repo.loading"
      @close="initOpen = false"
      @submit="submitInit"
    />
  </div>
</template>
