<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  ChevronRight,
  Clock,
  Folder,
  Inbox,
  Star,
  Tag as TagIcon,
  TreePine,
} from '@lucide/vue'
import GkSearchInput from '@/components/ui/GkSearchInput.vue'
import SidebarSection from './SidebarSection.vue'
import BranchRow from './BranchRow.vue'
import { useRepositoryStore } from '@/stores/repository'
import type { Branch } from '@/types/git'

const repo = useRepositoryStore()
const query = ref('')
const search = ref<InstanceType<typeof GkSearchInput>>()
const openGroups = reactive<Record<string, boolean>>({ feature: true })

defineExpose({
  focusSearch: () => search.value?.focus(),
})

const normalizedQuery = computed(() => query.value.trim().toLowerCase())

const filteredLocal = computed(() =>
  normalizedQuery.value
    ? repo.localBranches.filter((b) => b.name.toLowerCase().includes(normalizedQuery.value))
    : repo.localBranches,
)

const rootBranches = computed(() => filteredLocal.value.filter((b) => b.group === ''))

const groupedBranches = computed(() => {
  const groups = new Map<string, Branch[]>()
  for (const branch of filteredLocal.value) {
    if (branch.group === '') continue
    const list = groups.get(branch.group) ?? []
    list.push(branch)
    groups.set(branch.group, list)
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
})

const remoteBranches = computed(() =>
  normalizedQuery.value
    ? repo.remoteBranches.filter((b) => b.name.toLowerCase().includes(normalizedQuery.value))
    : repo.remoteBranches,
)

const recent = computed(() =>
  repo.recentBranches
    .map((name) => repo.localBranches.find((b) => b.name === name))
    .filter((b): b is Branch => Boolean(b)),
)

function isGroupOpen(group: string): boolean {
  return openGroups[group] ?? false
}
function toggleGroup(group: string): void {
  openGroups[group] = !isGroupOpen(group)
}
</script>

<template>
  <aside class="flex h-full flex-col bg-[var(--color-panel)]">
    <div class="border-b border-[var(--color-border)] p-2">
      <GkSearchInput
        ref="search"
        v-model="query"
        placeholder="Search branches"
        shortcut="⌘F"
      />
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto py-1">
      <!-- Favorites + Recent (only when not searching) -->
      <template v-if="!normalizedQuery">
        <SidebarSection section-key="favorites" title="Favorites" :count="repo.favoriteBranches.length">
          <div v-if="repo.favoriteBranches.length === 0" class="px-6 py-1 text-xs text-[var(--color-fg-subtle)]">
            <Star :size="12" class="mr-1 inline" /> Pin branches to see them here
          </div>
          <BranchRow v-for="branch in repo.favoriteBranches" :key="branch.id" :branch="branch" />
        </SidebarSection>

        <SidebarSection section-key="recent" title="Recently Checked Out" :count="recent.length">
          <div
            v-for="branch in recent"
            :key="branch.id"
            class="flex h-7 items-center gap-2 pr-2 pl-6 text-[13px] text-[var(--color-fg-muted)]"
          >
            <Clock :size="12" class="text-[var(--color-fg-subtle)]" />
            <span class="truncate">{{ branch.name }}</span>
          </div>
        </SidebarSection>
      </template>

      <!-- Local branches -->
      <SidebarSection section-key="localBranches" title="Local Branches" :count="filteredLocal.length">
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
      </SidebarSection>

      <!-- Remote branches -->
      <SidebarSection section-key="remoteBranches" title="Remote Branches" :count="remoteBranches.length">
        <div class="flex h-7 items-center gap-2 pr-2 pl-6 text-[12px] font-medium text-[var(--color-fg-subtle)]">
          <TreePine :size="12" /> origin
        </div>
        <BranchRow
          v-for="branch in remoteBranches"
          :key="branch.id"
          :branch="branch"
          :depth="1"
        />
      </SidebarSection>

      <!-- Tags -->
      <SidebarSection section-key="tags" title="Tags" :count="repo.tags.length">
        <div
          v-for="tag in repo.tags"
          :key="tag.id"
          class="flex h-7 items-center gap-2 rounded-md pr-2 pl-6 text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)]"
        >
          <TagIcon :size="13" class="text-[var(--color-warning)]" />
          <span class="flex-1 truncate">{{ tag.name }}</span>
          <span class="font-mono text-[10px] text-[var(--color-fg-subtle)]">{{ tag.sha.slice(0, 7) }}</span>
        </div>
      </SidebarSection>

      <!-- Stashes -->
      <SidebarSection section-key="stashes" title="Stashes" :count="repo.stashes.length">
        <div
          v-for="stash in repo.stashes"
          :key="stash.id"
          class="flex h-8 items-center gap-2 rounded-md pr-2 pl-6 text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)]"
        >
          <Inbox :size="13" class="text-[var(--color-info)]" />
          <div class="min-w-0 flex-1">
            <div class="truncate">{{ stash.message }}</div>
            <div class="truncate text-[10px] text-[var(--color-fg-subtle)]">
              on {{ stash.branch }} · {{ stash.filesChanged }} files
            </div>
          </div>
        </div>
      </SidebarSection>

      <!-- Worktrees -->
      <SidebarSection section-key="worktrees" title="Worktrees" :count="repo.worktrees.length">
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
      </SidebarSection>
    </div>
  </aside>
</template>
