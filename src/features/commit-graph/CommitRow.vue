<script setup lang="ts">
import { computed } from 'vue'
import {
  Check,
  Cherry,
  Copy,
  ExternalLink,
  GitBranch,
  GitMerge,
  RotateCcw,
  Spline,
  Tag as TagIcon,
} from '@lucide/vue'
import Avatar from '@/components/ui/Avatar.vue'
import Badge from '@/components/ui/Badge.vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import RefBadge from './RefBadge.vue'
import type { MenuItem } from '@/components/ui/menu'
import { relativeTime } from '@/lib/format'
import type { Commit } from '@/types/git'
import { useRepositoryStore } from '@/stores/repository'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{
  commit: Commit
  graphWidth: number
  selected: boolean
}>()

const repo = useRepositoryStore()
const toast = useToastStore()

const menu = computed<MenuItem[]>(() => [
  { label: 'Checkout Commit', icon: Check, onSelect: () => act('checkout') },
  { label: 'Create Branch Here', icon: GitBranch, onSelect: () => act('create-branch') },
  { label: 'Tag Commit', icon: TagIcon, onSelect: () => act('tag') },
  { separator: true },
  { label: 'Cherry Pick', icon: Cherry, onSelect: () => act('cherry-pick') },
  { label: 'Merge into Current', icon: GitMerge, onSelect: () => act('merge') },
  { label: 'Rebase From Here', icon: Spline, onSelect: () => act('rebase-from-here') },
  {
    label: 'Reset Current Branch to Here',
    icon: RotateCcw,
    children: [
      { label: 'Soft', shortcut: '--soft', onSelect: () => act('reset-soft') },
      { label: 'Mixed', shortcut: '--mixed', onSelect: () => act('reset-mixed') },
      { label: 'Hard', shortcut: '--hard', danger: true, onSelect: () => act('reset-hard') },
    ],
  },
  { separator: true },
  { label: 'Copy SHA', icon: Copy, shortcut: '⌘C', onSelect: copySha },
  { label: 'Open on GitHub', icon: ExternalLink, onSelect: openOnGithub },
])

function act(kind: Parameters<typeof repo.runAction>[0]['kind']): void {
  void repo.runAction({ kind, target: props.commit.shortSha })
}

function copySha(): void {
  void navigator.clipboard?.writeText(props.commit.sha)
  toast.push('Copied SHA to clipboard', 'info')
}

function openOnGithub(): void {
  void window.electron?.openExternal(
    `https://github.com/awesome-co/awesome-shop/commit/${props.commit.sha}`,
  )
  toast.push('Opening commit on GitHub', 'info')
}
</script>

<template>
  <ContextMenu :items="menu">
    <div
      class="group/row flex h-full items-center gap-2 pr-3 text-[13px]"
      :style="{ paddingLeft: `${graphWidth + 4}px` }"
    >
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <RefBadge v-for="(ref, i) in commit.refs" :key="i" :ref-data="ref" />
        <Cherry
          v-if="commit.isCherryPick"
          :size="13"
          class="shrink-0 text-[var(--color-lane-4)]"
        />
        <span
          class="truncate"
          :class="selected ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg)]/90'"
        >
          {{ commit.subject }}
        </span>
        <Badge v-if="commit.isMerge" tone="info">merge</Badge>
      </div>

      <Avatar :author="commit.author" :size="18" />
      <span class="hidden w-24 truncate text-right text-[var(--color-fg-muted)] xl:block">
        {{ commit.author.name }}
      </span>
      <span class="w-14 shrink-0 font-mono text-[11px] text-[var(--color-fg-subtle)]">
        {{ commit.shortSha }}
      </span>
      <span class="w-24 shrink-0 text-right text-[11px] text-[var(--color-fg-subtle)]">
        {{ relativeTime(commit.date) }}
      </span>
    </div>
  </ContextMenu>
</template>
