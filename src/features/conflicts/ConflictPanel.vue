<script setup lang="ts">
import { computed } from 'vue'
import { Check, Loader2, X } from '@lucide/vue'
import GkButton from '@/components/ui/GkButton.vue'
import { useRepositoryStore } from '@/stores/repository'
import { useRepoDiffStore } from '@/stores/repoDiff'

const repo = useRepositoryStore()
const diffStore = useRepoDiffStore()

const path = computed(() => diffStore.selectedFilePath)
const conflict = computed(() => diffStore.conflict)
const blockCount = computed(() => conflict.value?.blocks.length ?? 0)

function lineRows(text: string): string[] {
  if (!text) return ['']
  return text.split('\n')
}
</script>

<template>
  <section
    v-if="path"
    class="flex max-h-[42%] min-h-0 shrink-0 flex-col border-t border-[var(--color-border)] bg-[var(--color-app)]"
  >
    <header
      class="flex h-8 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-3 text-[11px] font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase"
    >
      <span class="flex-1 truncate normal-case text-[var(--color-danger)]">{{ path }}</span>
      <span v-if="blockCount" class="font-mono text-[10px] normal-case text-[var(--color-warning)]">
        {{ blockCount }} conflict{{ blockCount === 1 ? '' : 's' }}
      </span>
      <button
        class="focus-ring rounded px-1.5 py-0.5 text-[10px] normal-case text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]"
        @click="diffStore.selectFile(null)"
      >
        Close
      </button>
    </header>

    <div
      v-if="diffStore.conflictLoading"
      class="flex flex-1 items-center justify-center text-xs text-[var(--color-fg-subtle)]"
    >
      <Loader2 :size="16" class="mr-2 animate-spin" /> Loading conflict…
    </div>

    <div
      v-else-if="conflict?.binary"
      class="flex flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
    >
      Binary file — resolve using an external merge tool or choose ours/theirs.
    </div>

    <template v-else-if="conflict">
      <div class="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <GkButton size="sm" variant="secondary" @click="repo.resolveConflictOurs(path!)">
          Use Ours
        </GkButton>
        <GkButton size="sm" variant="secondary" @click="repo.resolveConflictTheirs(path!)">
          Use Theirs
        </GkButton>
        <GkButton
          v-if="!conflict.hasMarkers"
          size="sm"
          variant="primary"
          @click="repo.markConflictResolved(path!)"
        >
          <Check :size="13" /> Mark Resolved
        </GkButton>
      </div>

      <div
        v-if="!conflict.hasMarkers"
        class="flex flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
      >
        No conflict markers remain. Mark this file as resolved to stage it.
      </div>

      <div v-else class="min-h-0 flex-1 overflow-y-auto p-2 space-y-3">
        <article
          v-for="block in conflict.blocks"
          :key="block.index"
          class="overflow-hidden rounded-md border border-[var(--color-danger)]/30"
        >
          <header
            class="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-danger)]/8 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]"
          >
            <span>Conflict {{ block.index + 1 }}</span>
            <div class="flex items-center gap-1 normal-case">
              <GkButton
                size="sm"
                variant="ghost"
                @click="repo.resolveConflictBlock(path!, block.index, 'ours')"
              >
                Use Ours
              </GkButton>
              <GkButton
                size="sm"
                variant="ghost"
                @click="repo.resolveConflictBlock(path!, block.index, 'theirs')"
              >
                Use Theirs
              </GkButton>
            </div>
          </header>

          <div class="grid grid-cols-2 divide-x divide-[var(--color-border)]">
            <div class="min-w-0">
              <div
                class="border-b border-[var(--color-border)] bg-[var(--color-success)]/8 px-2 py-1 text-[10px] font-medium text-[var(--color-success)]"
              >
                Ours — {{ block.oursLabel }}
              </div>
              <pre class="max-h-32 overflow-auto p-2 font-mono text-[11px] leading-5 text-[var(--color-fg)]"><code
                v-for="(line, i) in lineRows(block.ours)"
                :key="`ours-${block.index}-${i}`"
                class="block whitespace-pre-wrap break-all"
              >{{ line }}</code></pre>
            </div>
            <div class="min-w-0">
              <div
                class="border-b border-[var(--color-border)] bg-[var(--color-info)]/8 px-2 py-1 text-[10px] font-medium text-[var(--color-info)]"
              >
                Theirs — {{ block.theirsLabel }}
              </div>
              <pre class="max-h-32 overflow-auto p-2 font-mono text-[11px] leading-5 text-[var(--color-fg)]"><code
                v-for="(line, i) in lineRows(block.theirs)"
                :key="`theirs-${block.index}-${i}`"
                class="block whitespace-pre-wrap break-all"
              >{{ line }}</code></pre>
            </div>
          </div>

          <div
            v-if="block.base"
            class="border-t border-[var(--color-border)] bg-[var(--color-panel)]"
          >
            <div class="px-2 py-1 text-[10px] font-medium text-[var(--color-fg-muted)]">
              Base (common ancestor)
            </div>
            <pre class="max-h-20 overflow-auto px-2 pb-2 font-mono text-[11px] leading-5 text-[var(--color-fg-muted)]"><code
              v-for="(line, i) in lineRows(block.base)"
              :key="`base-${block.index}-${i}`"
              class="block whitespace-pre-wrap break-all"
            >{{ line }}</code></pre>
          </div>
        </article>
      </div>
    </template>

    <div
      v-else
      class="flex flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
    >
      <X :size="14" class="mr-1.5 shrink-0" /> Could not load conflict details.
    </div>
  </section>
</template>
