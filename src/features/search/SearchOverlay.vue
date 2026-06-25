<script setup lang="ts">
import { ref, watch } from 'vue'
import { FileText, GitCommitHorizontal, Loader2, Search, X } from '@lucide/vue'
import GkSearchInput from '@/components/ui/GkSearchInput.vue'
import { gitService } from '@/lib/git'
import type { SearchCommitHit } from '@shared/git/models'
import { useRepositoryStore } from '@/stores/repository'
import { useSelectionStore } from '@/stores/selection'

const repo = useRepositoryStore()
const selection = useSelectionStore()

const query = ref('')
const loading = ref(false)
const commits = ref<SearchCommitHit[]>([])
const files = ref<string[]>([])

watch(
  () => repo.searchOpen,
  (open) => {
    if (open) {
      query.value = ''
      commits.value = []
      files.value = []
    }
  },
)

async function runSearch(): Promise<void> {
  const text = query.value.trim()
  if (!text) return
  loading.value = true
  try {
    const results = await gitService.search({ text, limit: 40 })
    commits.value = results.commits
    files.value = results.files
  } finally {
    loading.value = false
  }
}

function selectCommit(hit: SearchCommitHit): void {
  selection.select(hit.sha)
  repo.closeSearch()
}

function selectFile(path: string): void {
  repo.selectFile(path)
  repo.closeSearch()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') repo.closeSearch()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="repo.searchOpen"
      class="fixed inset-0 z-[180] flex items-start justify-center bg-black/50 p-6 pt-[12vh] backdrop-blur-[1px]"
      @click.self="repo.closeSearch()"
      @keydown="onKeydown"
    >
      <div
        class="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-panel)] shadow-2xl"
        role="dialog"
        aria-label="Search repository"
      >
        <div class="flex items-center gap-2 border-b border-[var(--color-border)] p-3">
          <Search :size="18" class="shrink-0 text-[var(--color-fg-subtle)]" />
          <GkSearchInput
            v-model="query"
            class="flex-1"
            placeholder="Search commits and files…"
            @keydown.enter="runSearch()"
          />
          <button
            class="focus-ring rounded p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]"
            @click="repo.closeSearch()"
          >
            <X :size="16" />
          </button>
        </div>

        <div class="max-h-[50vh] overflow-y-auto p-2">
          <div v-if="loading" class="flex items-center justify-center py-8 text-sm text-[var(--color-fg-subtle)]">
            <Loader2 :size="16" class="mr-2 animate-spin" /> Searching…
          </div>

          <template v-else-if="commits.length || files.length">
            <div v-if="commits.length" class="mb-3">
              <div class="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fg-subtle)]">
                Commits
              </div>
              <button
                v-for="hit in commits"
                :key="hit.sha"
                class="focus-ring flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-[var(--color-hover)]"
                @click="selectCommit(hit)"
              >
                <GitCommitHorizontal :size="14" class="mt-0.5 shrink-0 text-[var(--color-accent)]" />
                <div class="min-w-0">
                  <div class="truncate text-sm text-[var(--color-fg)]">{{ hit.subject }}</div>
                  <div class="text-[11px] text-[var(--color-fg-subtle)]">
                    {{ hit.shortSha }} · {{ hit.author }}
                  </div>
                </div>
              </button>
            </div>

            <div v-if="files.length">
              <div class="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fg-subtle)]">
                Files
              </div>
              <button
                v-for="path in files"
                :key="path"
                class="focus-ring flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-[var(--color-hover)]"
                @click="selectFile(path)"
              >
                <FileText :size="14" class="shrink-0 text-[var(--color-fg-muted)]" />
                <span class="truncate text-sm text-[var(--color-fg)]">{{ path }}</span>
              </button>
            </div>
          </template>

          <div
            v-else-if="query.trim()"
            class="py-8 text-center text-sm text-[var(--color-fg-subtle)]"
          >
            No results. Press Enter to search.
          </div>

          <div v-else class="py-8 text-center text-sm text-[var(--color-fg-subtle)]">
            Type to search commits and tracked files.
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
