<script setup lang="ts">
import { computed, inject, reactive } from 'vue'
import { ChevronRight, Folder, FolderOpen, Inbox, Star, Tag as TagIcon, Trash2, TreePine } from '@lucide/vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import type { MenuItem } from '@/components/ui/menu'
import BranchRow from './BranchRow.vue'
import SidebarVirtualList from './SidebarVirtualList.vue'
import { sortCurrentBranchFirst } from './sortBranches'
import type { BranchSidebarData } from './useBranchSidebarData'
import type { SectionKey } from '@/lib/preferences'
import type { Branch, Stash, Tag } from '@/types/git'

const props = defineProps<{ section: SectionKey }>()

const data = inject<BranchSidebarData>('branchSidebarData')!
const { repo, normalizedQuery, rootBranches, groupedBranches, groupedRemoteBranches } = data

/** Row height inside a windowed section (`h-7`); windowing assumes fixed heights. */
const ROW_HEIGHT = 28

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

type Row =
  | { kind: 'branch'; key: string; branch: Branch; depth: number }
  | {
      kind: 'group'
      key: string
      label: string
      count: number
      remote: boolean
      group: string
      open: boolean
    }
  | { kind: 'tag'; key: string; tag: Tag }

/**
 * Header row plus the group's branches when it is open (or a search is active).
 * The rows stay a flat list so every section can share one windowing renderer.
 */
function groupRows(input: {
  key: string
  label: string
  branches: Branch[]
  remote: boolean
}): Row[] {
  const expanded = isGroupOpen(input.key) || Boolean(normalizedQuery.value)
  return [
    {
      kind: 'group',
      key: `group:${input.key}`,
      label: input.label,
      count: input.branches.length,
      remote: input.remote,
      group: input.key,
      open: isGroupOpen(input.key),
    },
    ...(expanded
      ? input.branches.map((branch) => ({
          kind: 'branch' as const,
          key: branch.id,
          branch,
          depth: 1,
        }))
      : []),
  ]
}

/**
 * Every visible row of this section. Real repositories reach thousands of rows
 * here (erp: 1,703 remote branches, 775 tags), which is why the windowed
 * sections only render what fits the viewport.
 */
const rows = computed<Row[]>(() => {
  switch (props.section) {
    case 'favorites':
      return sortCurrentBranchFirst(repo.favoriteBranches).map((branch) => ({
        kind: 'branch' as const,
        key: branch.id,
        branch,
        depth: 0,
      }))
    case 'localBranches':
      return [
        ...rootBranches.value.map((branch) => ({
          kind: 'branch' as const,
          key: branch.id,
          branch,
          depth: 0,
        })),
        ...groupedBranches.value.flatMap(([group, branches]) =>
          groupRows({ key: group, label: group, branches, remote: false }),
        ),
      ]
    case 'remoteBranches':
      return groupedRemoteBranches.value.flatMap(([remote, branches]) =>
        groupRows({ key: remoteGroupKey(remote), label: remote, branches, remote: true }),
      )
    case 'tags':
      return repo.tags.map((tag) => ({ kind: 'tag' as const, key: tag.id, tag }))
    default:
      return []
  }
})

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

function worktreeMenu(worktree: { path: string; isMain: boolean }): MenuItem[] {
  const items: MenuItem[] = [
    {
      label: 'Reveal in Finder',
      icon: FolderOpen,
      onSelect: () => void repo.runAction({ kind: 'reveal-in-finder', target: worktree.path }),
    },
  ]
  if (!worktree.isMain) {
    items.push({
      label: 'Remove Worktree',
      icon: Trash2,
      danger: true,
      onSelect: () => void repo.removeWorktree(worktree.path),
    })
  }
  return items
}
</script>

<template>
  <template v-if="section === 'tags'">
    <SidebarVirtualList v-if="rows.length" :count="rows.length" :row-height="ROW_HEIGHT">
      <template #default="{ start, end }">
        <template v-for="row in rows.slice(start, end)" :key="row.key">
          <ContextMenu v-if="row.kind === 'tag'" :items="tagMenu(row.tag)">
            <div
              class="flex h-7 cursor-pointer items-center gap-2 rounded-md pr-2 pl-6 text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)]"
              @dblclick="void repo.runAction({ kind: 'checkout-tag', target: row.tag.name })"
            >
              <TagIcon :size="13" class="shrink-0 text-[var(--color-warning)]" />
              <span class="flex-1 truncate">{{ row.tag.name }}</span>
              <span class="font-mono text-[10px] text-[var(--color-fg-subtle)]">{{ row.tag.sha.slice(0, 7) }}</span>
            </div>
          </ContextMenu>
        </template>
      </template>
    </SidebarVirtualList>
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
    <ContextMenu
      v-for="worktree in repo.worktrees"
      :key="worktree.id"
      :items="worktreeMenu(worktree)"
    >
      <div
        class="flex h-8 cursor-pointer items-center gap-2 rounded-md pr-2 pl-6 text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)]"
      >
        <TreePine :size="13" class="text-[var(--color-success)]" />
        <div class="min-w-0 flex-1">
          <div class="truncate">{{ worktree.path }}</div>
          <div class="truncate text-[10px] text-[var(--color-fg-subtle)]">{{ worktree.branch }}</div>
        </div>
      </div>
    </ContextMenu>
    <button
      class="mx-2 mt-1 w-[calc(100%-1rem)] rounded-md px-2 py-1 text-left text-xs text-[var(--color-accent)] hover:bg-[var(--color-hover)]"
      @click="repo.addWorktree()"
    >
      + Add worktree
    </button>
  </template>

  <template v-else>
    <div
      v-if="section === 'favorites' && rows.length === 0"
      class="px-6 py-1 text-xs text-[var(--color-fg-subtle)]"
    >
      <Star :size="12" class="mr-1 inline" /> Pin branches to see them here
    </div>

    <SidebarVirtualList v-else :count="rows.length" :row-height="ROW_HEIGHT">
      <template #default="{ start, end }">
        <template v-for="row in rows.slice(start, end)" :key="row.key">
          <BranchRow v-if="row.kind === 'branch'" :branch="row.branch" :depth="row.depth" />

          <button
            v-else-if="row.kind === 'group'"
            class="focus-ring flex h-7 w-full items-center gap-2 rounded-md pr-2 pl-6 text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)]"
            @click="toggleGroup(row.group)"
          >
            <ChevronRight
              :size="13"
              class="shrink-0 transition-transform duration-150"
              :class="row.open ? 'rotate-90' : ''"
            />
            <TreePine v-if="row.remote" :size="13" class="shrink-0 text-[var(--color-fg-subtle)]" />
            <Folder v-else :size="13" class="shrink-0 text-[var(--color-fg-subtle)]" />
            <span class="flex-1 text-left">{{ row.label }}</span>
            <span class="font-mono text-[10px] text-[var(--color-fg-subtle)]">{{ row.count }}</span>
          </button>
        </template>
      </template>
    </SidebarVirtualList>
  </template>
</template>
