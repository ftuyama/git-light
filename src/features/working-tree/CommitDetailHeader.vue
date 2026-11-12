<script setup lang="ts">
import { computed } from 'vue'
import { Copy, GitMerge } from '@lucide/vue'
import Avatar from '@/components/ui/Avatar.vue'
import { fullTimestamp, relativeTime } from '@/lib/format'
import type { Commit, FileStatus, WorkingTreeFile } from '@/types/git'
import { useToastStore } from '@/stores/toast'
import { groupFileStatuses, STATUS_META } from './fileStatus'

const props = defineProps<{
  commit: Commit
  files: WorkingTreeFile[]
}>()

const toast = useToastStore()

const statusBreakdown = computed(() => groupFileStatuses(props.files))

function statusLabel(status: FileStatus): string {
  return STATUS_META[status].label.toLowerCase()
}

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
    <p class="text-[15px] font-semibold leading-snug text-[var(--color-fg)]">
      {{ commit.subject }}
    </p>
    <p
      v-if="commit.body?.trim()"
      class="mt-2 max-h-20 overflow-y-auto border-t border-[var(--color-border)] pt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--color-fg-muted)]"
    >
      {{ commit.body.trim() }}
    </p>

    <div v-if="commit.isMerge" class="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span
        class="shrink-0 text-[var(--color-info)]"
        title="Merge commit"
        aria-label="Merge commit"
      >
        <GitMerge :size="14" />
      </span>
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
      <span v-if="statusBreakdown.length" class="text-[var(--color-fg-subtle)]">·</span>
      <span
        v-if="statusBreakdown.length"
        class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[var(--color-fg-muted)]"
      >
        <span
          v-for="group in statusBreakdown"
          :key="group.status"
          class="flex items-center gap-1"
          :title="STATUS_META[group.status].label"
        >
          <component
            :is="STATUS_META[group.status].icon"
            v-if="STATUS_META[group.status].icon"
            :size="11"
            :style="{ color: STATUS_META[group.status].color }"
          />
          <span v-else class="font-mono" :style="{ color: STATUS_META[group.status].color }">
            {{ STATUS_META[group.status].letter }}
          </span>
          <span>{{ group.count }} {{ statusLabel(group.status) }}</span>
        </span>
      </span>
    </div>

  </div>
</template>
