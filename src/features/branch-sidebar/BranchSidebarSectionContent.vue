<script setup lang="ts">
import { inject, reactive } from 'vue'
import { ChevronRight, Folder, Inbox, Star, Tag as TagIcon, TreePine } from '@lucide/vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import type { MenuItem } from '@/components/ui/menu'
import BranchRow from './BranchRow.vue'
import { sortCurrentBranchFirst } from './sortBranches'
import type { BranchSidebarData } from './useBranchSidebarData'
import type { SectionKey } from '@/lib/preferences'
import type { Stash, Tag } from '@/types/git'

defineProps<{ section: SectionKey }>()

const data = inject<BranchSidebarData>('branchSidebarData')!
const { repo, normalizedQuery, rootBranches, groupedBranches, groupedRemoteBranches } = data

const openGroups = reactive<Record<string, boolean>>({})

function remoteGroupKey(remote: string): string {
  return `remote:${remote}`
}

function isGroupOpen(group: string): boolean {
  return openGroups[group] ?? true
}
function toggleGroup(group: string): void {
  openGroups[group] = !isGroupOpen(group)
}

function tagMenu(tag: Tag): MenuItem[] {
  return [
    { label: 'Checkout Tag', onSelect: () => void repo.runAction({ kind: 'checkout-tag', target: tag.name }) },
    { label: 'Delete Tag', danger: true, onSelect: () => void repo.runAction({ kind: 'delete-tag', target: tag.name }) },
  ]
}

function stashMenu(stash: Stash): MenuItem[] {
  const ref = `stash@{${stash.index}}`
  return [
    { label: 'Apply', onSelect: () => void repo.runAction({ kind: 'apply-stash', target: ref }) },
    { label: 'Pop', onSelect: () => void repo.runAction({ kind: 'pop-stash', target: ref }) },
    { label: 'Drop', danger: true, onSelect: () => void repo.runAction({ kind: 'drop-stash', target: ref }) },
  ]
}
</script>

<template>
  <template v-if="section === 'favorites'">
    <div v-if="repo.favoriteBranches.length === 0" class="px-6 py-1 text-xs text-[var(--color-fg-subtle)]">
      <Star :size="12" class="mr-1 inline" /> Pin branches to see them here
    </div>
    <BranchRow v-for="branch in sortCurrentBranchFirst(repo.favoriteBranches)" :key="branch.id" :branch="branch" />
  </template>

  <template v-else-if="section === 'localBranches'">
    <BranchRow v-for="branch in rootBranches" :key="branch.id" :branch="branch" />

    <template v-for="[group, branches] in groupedBranches" :key="group">
      <button
        class="focus-ring flex h-7 w-full items-center gap-2 rounded-md pr-2 pl-6 text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)]"
        @click="toggleGroup(group)"
      >
        <ChevronRight
          :size="13"
          class="shrink-0 transition-transform duration-150"
          :class="isGroupOpen(group) ? 'rotate-90' : ''"
        />
        <Folder :size="13" class="text-[var(--color-fg-subtle)]" />
        <span class="flex-1 text-left">{{ group }}</span>
        <span class="font-mono text-[10px] text-[var(--color-fg-subtle)]">{{ branches.length }}</span>
      </button>
      <template v-if="isGroupOpen(group) || normalizedQuery">
        <BranchRow v-for="branch in branches" :key="branch.id" :branch="branch" :depth="1" />
      </template>
    </template>
  </template>

  <template v-else-if="section === 'remoteBranches'">
    <template v-for="[remote, branches] in groupedRemoteBranches" :key="remote">
      <button
        class="focus-ring flex h-7 w-full items-center gap-2 rounded-md pr-2 pl-6 text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)]"
        @click="toggleGroup(remoteGroupKey(remote))"
      >
        <ChevronRight
          :size="13"
          class="shrink-0 transition-transform duration-150"
          :class="isGroupOpen(remoteGroupKey(remote)) ? 'rotate-90' : ''"
        />
        <TreePine :size="13" class="text-[var(--color-fg-subtle)]" />
        <span class="flex-1 text-left">{{ remote }}</span>
        <span class="font-mono text-[10px] text-[var(--color-fg-subtle)]">{{ branches.length }}</span>
      </button>
      <template v-if="isGroupOpen(remoteGroupKey(remote)) || normalizedQuery">
        <BranchRow v-for="branch in branches" :key="branch.id" :branch="branch" :depth="1" />
      </template>
    </template>
  </template>

  <template v-else-if="section === 'tags'">
    <ContextMenu v-for="tag in repo.tags" :key="tag.id" :items="tagMenu(tag)">
      <div
        class="flex h-7 cursor-pointer items-center gap-2 rounded-md pr-2 pl-6 text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)]"
        @dblclick="void repo.runAction({ kind: 'checkout-tag', target: tag.name })"
      >
        <TagIcon :size="13" class="text-[var(--color-warning)]" />
        <span class="flex-1 truncate">{{ tag.name }}</span>
        <span class="font-mono text-[10px] text-[var(--color-fg-subtle)]">{{ tag.sha.slice(0, 7) }}</span>
      </div>
    </ContextMenu>
    <button
      class="mx-2 mt-1 w-[calc(100%-1rem)] rounded-md px-2 py-1 text-left text-xs text-[var(--color-accent)] hover:bg-[var(--color-hover)]"
      @click="repo.createTag()"
    >
      + Create tag
    </button>
  </template>

  <template v-else-if="section === 'stashes'">
    <ContextMenu v-for="stash in repo.stashes" :key="stash.id" :items="stashMenu(stash)">
      <div
        class="flex h-8 cursor-pointer items-center gap-2 rounded-md pr-2 pl-6 text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)]"
      >
        <Inbox :size="13" class="text-[var(--color-info)]" />
        <div class="min-w-0 flex-1">
          <div class="truncate">{{ stash.message }}</div>
          <div class="truncate text-[10px] text-[var(--color-fg-subtle)]">
            on {{ stash.branch }} · {{ stash.filesChanged }} files
          </div>
        </div>
      </div>
    </ContextMenu>
  </template>

  <template v-else-if="section === 'worktrees'">
    <div
      v-for="worktree in repo.worktrees"
      :key="worktree.id"
      class="flex h-8 items-center gap-2 rounded-md pr-2 pl-6 text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)]"
    >
      <TreePine :size="13" class="text-[var(--color-success)]" />
      <div class="min-w-0 flex-1">
        <div class="truncate">{{ worktree.path }}</div>
        <div class="truncate text-[10px] text-[var(--color-fg-subtle)]">{{ worktree.branch }}</div>
      </div>
    </div>
  </template>
</template>
