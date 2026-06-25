<script setup lang="ts">
import { computed } from 'vue'
import { Loader2 } from '@lucide/vue'
import { useRepositoryStore } from '@/stores/repository'

const repo = useRepositoryStore()

const lines = computed(() => {
  const diff = repo.diff
  if (!diff) return []
  const out: { key: string; type: string; content: string }[] = []
  for (const hunk of diff.hunks) {
    out.push({ key: hunk.header, type: 'hunk', content: hunk.header })
    for (const line of hunk.lines) {
      out.push({
        key: `${hunk.header}-${line.oldLine}-${line.newLine}-${line.content}`,
        type: line.type,
        content: line.content,
      })
    }
  }
  return out
})

function lineClass(type: string): string {
  switch (type) {
    case 'add':
      return 'bg-[var(--color-success)]/12 text-[var(--color-success)]'
    case 'del':
      return 'bg-[var(--color-danger)]/12 text-[var(--color-danger)]'
    case 'hunk':
      return 'bg-[var(--color-info)]/10 text-[var(--color-info)] font-medium'
    default:
      return 'text-[var(--color-fg-muted)]'
  }
}
</script>

<template>
  <section
    v-if="repo.selectedFilePath"
    class="flex max-h-[42%] min-h-0 shrink-0 flex-col border-t border-[var(--color-border)] bg-[var(--color-app)]"
  >
    <header
      class="flex h-8 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-3 text-[11px] font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase"
    >
      <span class="flex-1 truncate normal-case">{{ repo.selectedFilePath }}</span>
      <span v-if="repo.diff" class="font-mono text-[10px] normal-case">
        +{{ repo.diff.additions }} −{{ repo.diff.deletions }}
      </span>
      <button
        class="focus-ring rounded px-1.5 py-0.5 text-[10px] normal-case text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)]"
        @click="repo.selectFile(null)"
      >
        Close
      </button>
    </header>

    <div v-if="repo.diffLoading" class="flex flex-1 items-center justify-center text-xs text-[var(--color-fg-subtle)]">
      <Loader2 :size="16" class="mr-2 animate-spin" /> Loading diff…
    </div>

    <div
      v-else-if="repo.diff?.tooLarge"
      class="flex flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
    >
      File is too large to diff in the UI.
    </div>

    <div
      v-else-if="repo.diff?.binary"
      class="flex flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
    >
      Binary file — no text diff available.
    </div>

    <pre
      v-else
      class="min-h-0 flex-1 overflow-auto p-2 font-mono text-[11px] leading-5"
    ><code
      v-for="line in lines"
      :key="line.key"
      class="block whitespace-pre-wrap break-all px-1"
      :class="lineClass(line.type)"
    >{{ line.content }}</code></pre>
  </section>
</template>
