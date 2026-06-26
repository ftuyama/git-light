<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown, Copy } from '@lucide/vue'
import Avatar from '@/components/ui/Avatar.vue'
import Badge from '@/components/ui/Badge.vue'
import { fullTimestamp, relativeTime } from '@/lib/format'
import type { Commit } from '@/types/git'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{
  commit: Commit
  fileCount: number
}>()

const toast = useToastStore()
const bodyExpanded = ref(false)

function copySha(): void {
  void navigator.clipboard?.writeText(props.commit.sha)
  toast.push('Copied SHA to clipboard', 'info')
}

function shortParent(sha: string): string {
  return sha.slice(0, 7)
}
</script>

<template>
  <div class="shrink-0 border-b border-[var(--color-border)] px-3 py-2.5">
    <p class="text-[13px] font-medium leading-snug text-[var(--color-fg)]">
      {{ commit.subject }}
    </p>

    <div v-if="commit.isMerge" class="mt-1.5 flex flex-wrap items-center gap-1.5">
      <Badge tone="info">merge</Badge>
      <span class="text-[11px] text-[var(--color-fg-subtle)]">
        Parents:
        <span
          v-for="(parent, index) in commit.parents"
          :key="parent"
          class="font-mono"
        >
          {{ shortParent(parent) }}<span v-if="index < commit.parents.length - 1">, </span>
        </span>
      </span>
    </div>

    <div class="mt-2 flex items-center gap-2">
      <Avatar :author="commit.author" :size="22" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-[12px] text-[var(--color-fg)]">{{ commit.author.name }}</p>
        <p class="truncate text-[11px] text-[var(--color-fg-subtle)]" :title="fullTimestamp(commit.date)">
          {{ fullTimestamp(commit.date) }} · {{ relativeTime(commit.date) }}
        </p>
      </div>
    </div>

    <div class="mt-2 flex items-center gap-2 text-[11px]">
      <button
        class="focus-ring flex items-center gap-1 rounded px-1 py-0.5 font-mono text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
        :title="commit.sha"
        @click="copySha"
      >
        {{ commit.shortSha }}
        <Copy :size="11" />
      </button>
      <span class="text-[var(--color-fg-subtle)]">·</span>
      <span class="text-[var(--color-fg-muted)]">{{ fileCount }} {{ fileCount === 1 ? 'file' : 'files' }}</span>
    </div>

    <button
      v-if="commit.body?.trim()"
      class="focus-ring mt-2 flex w-full items-center gap-1 text-left text-[11px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
      @click="bodyExpanded = !bodyExpanded"
    >
      <ChevronDown
        :size="12"
        class="shrink-0 transition-transform"
        :class="bodyExpanded ? 'rotate-180' : ''"
      />
      {{ bodyExpanded ? 'Hide message' : 'Show message' }}
    </button>
    <pre
      v-if="bodyExpanded && commit.body?.trim()"
      class="mt-1.5 max-h-32 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--color-fg-muted)]"
    >{{ commit.body.trim() }}</pre>
  </div>
</template>
