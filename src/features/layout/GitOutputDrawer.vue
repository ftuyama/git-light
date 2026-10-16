<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Terminal, Trash2, X } from '@lucide/vue'
import { useGitOutputStore } from '@/stores/gitOutput'
import { useRepositoryStore } from '@/stores/repository'

const output = useGitOutputStore()
const repo = useRepositoryStore()
const { open } = storeToRefs(output)

const entries = computed(() => output.entriesFor(repo.repository?.path))

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}
</script>

<template>
  <div
    v-if="open"
    class="flex h-48 shrink-0 flex-col border-t border-[var(--color-border)] bg-[var(--color-panel)]"
  >
    <div class="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-1.5 text-[11px]">
      <Terminal :size="12" class="text-[var(--color-fg-subtle)]" />
      <span class="font-medium">Git output</span>
      <span class="text-[var(--color-fg-subtle)]">{{ repo.repository?.name ?? 'no repo' }} · {{ entries.length }} entries</span>
      <div class="flex-1" />
      <button
        class="app-no-drag focus-ring rounded p-1 hover:bg-[var(--color-hover)]"
        title="Clear output for this tab"
        @click="output.clear(repo.repository?.path)"
      >
        <Trash2 :size="12" />
      </button>
      <button
        class="app-no-drag focus-ring rounded p-1 hover:bg-[var(--color-hover)]"
        title="Close output"
        @click="output.setOpen(false)"
      >
        <X :size="12" />
      </button>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
      <p v-if="entries.length === 0" class="font-sans text-[var(--color-fg-subtle)]">
        No git commands yet in this tab. Run fetch, pull, push, checkout, etc.
      </p>
      <div v-for="entry in entries" :key="entry.id" class="mb-2">
        <div class="flex items-center gap-2 font-sans text-[11px]">
          <span class="text-[var(--color-fg-subtle)]">{{ formatTime(entry.timestamp) }}</span>
          <span
            class="rounded px-1"
            :class="entry.ok ? 'bg-[var(--color-success-muted)] text-[var(--color-success)]' : 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]'"
          >
            {{ entry.ok ? 'ok' : 'error' }}
          </span>
          <span class="font-medium">{{ entry.actionKind }}{{ entry.target ? ` ${entry.target}` : '' }}</span>
          <span class="truncate text-[var(--color-fg-muted)]">{{ entry.message }}</span>
        </div>
        <div v-for="(cmd, i) in entry.commands" :key="i" class="mt-0.5 rounded bg-[var(--color-app)] p-1.5">
          <div class="whitespace-pre-wrap break-all text-[var(--color-accent)]">$ {{ cmd.command }}</div>
          <div v-if="cmd.stdout" class="whitespace-pre-wrap break-all">{{ cmd.stdout }}</div>
          <div v-if="cmd.stderr" class="whitespace-pre-wrap break-all text-[var(--color-danger)]">{{ cmd.stderr }}</div>
          <div v-if="cmd.exitCode !== 0 && cmd.exitCode !== null" class="text-[var(--color-fg-subtle)]">exit {{ cmd.exitCode }}</div>
        </div>
        <div v-if="entry.commands.length === 0" class="text-[var(--color-fg-subtle)]">no command captured</div>
      </div>
    </div>
  </div>
</template>
