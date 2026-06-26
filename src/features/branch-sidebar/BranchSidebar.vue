<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import { Loader2 } from '@lucide/vue'
import GkSearchInput from '@/components/ui/GkSearchInput.vue'
import SidebarSection from './SidebarSection.vue'
import BranchSidebarSectionContent from './BranchSidebarSectionContent.vue'
import BranchIntegrateDialog from './BranchIntegrateDialog.vue'
import { pendingBranchIntegrate } from './useBranchDragDrop'
import { useBranchSidebarData } from './useBranchSidebarData'
import { useRepositoryStore } from '@/stores/repository'
import { useUiStore } from '@/stores/ui'
import { SECTION_KEYS, SECTION_LABELS, type SectionKey } from '@/lib/preferences'

const repo = useRepositoryStore()
const ui = useUiStore()
const query = ref('')
const search = ref<InstanceType<typeof GkSearchInput>>()

const sidebarData = useBranchSidebarData(query)
provide('branchSidebarData', sidebarData)
const { normalizedQuery, filteredLocal, remoteBranches, hasLocalMatches } = sidebarData

defineExpose({
  focusSearch: () => search.value?.focus(),
})

const visibleSectionKeys = computed(() =>
  SECTION_KEYS.filter((key) => key !== 'favorites' || !normalizedQuery.value),
)

const openSectionKeys = computed(() =>
  visibleSectionKeys.value.filter((key) => ui.isSectionOpen(key)),
)

const collapsedSectionKeys = computed(() =>
  visibleSectionKeys.value.filter((key) => !ui.isSectionOpen(key)),
)

function sectionCount(key: SectionKey): number {
  switch (key) {
    case 'favorites':
      return repo.favoriteBranches.length
    case 'localBranches':
      return filteredLocal.value.length
    case 'remoteBranches':
      return remoteBranches.value.length
    case 'tags':
      return repo.tags.length
    case 'stashes':
      return repo.stashes.length
    case 'worktrees':
      return repo.worktrees.length
  }
}

const integrateOpen = computed(() => pendingBranchIntegrate.value != null)
const integrateSource = computed(() => pendingBranchIntegrate.value?.source ?? null)
const integrateTarget = computed(() => pendingBranchIntegrate.value?.target ?? null)

function closeIntegrateDialog(): void {
  pendingBranchIntegrate.value = null
}

async function confirmIntegrate(mode: 'merge' | 'rebase'): Promise<void> {
  const request = pendingBranchIntegrate.value
  if (!request) return
  pendingBranchIntegrate.value = null
  await repo.integrateBranches(request.source, request.target, mode)
}
</script>

<template>
  <aside class="relative flex h-full flex-col bg-[var(--color-panel)]">
    <Transition name="sidebar-dim">
      <div
        v-if="repo.branchSwitching"
        class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/30"
        aria-hidden="true"
      >
        <Loader2 :size="22" class="animate-spin text-[var(--color-fg-muted)]" />
      </div>
    </Transition>

    <div class="border-b border-[var(--color-border)] p-2">
      <GkSearchInput
        ref="search"
        v-model="query"
        placeholder="Search branches"
        shortcut="⌘F"
      />
    </div>

    <div
      v-if="normalizedQuery && !hasLocalMatches"
      class="px-4 py-6 text-center text-xs text-[var(--color-fg-subtle)]"
    >
      No branches match &ldquo;{{ query.trim() }}&rdquo;
    </div>

    <div v-else class="min-h-0 flex-1 overflow-y-auto py-1">
      <SidebarSection
        v-for="sectionKey in openSectionKeys"
        :key="sectionKey"
        :section-key="sectionKey"
        :title="SECTION_LABELS[sectionKey]"
        :count="sectionCount(sectionKey)"
      >
        <BranchSidebarSectionContent :section="sectionKey" />
      </SidebarSection>
    </div>

    <div
      v-if="collapsedSectionKeys.length > 0"
      class="shrink-0 border-t border-[var(--color-border)] py-1"
    >
      <SidebarSection
        v-for="sectionKey in collapsedSectionKeys"
        :key="sectionKey"
        :section-key="sectionKey"
        :title="SECTION_LABELS[sectionKey]"
        :count="sectionCount(sectionKey)"
      >
        <BranchSidebarSectionContent :section="sectionKey" />
      </SidebarSection>
    </div>

    <BranchIntegrateDialog
      :open="integrateOpen"
      :source="integrateSource"
      :target="integrateTarget"
      @cancel="closeIntegrateDialog"
      @merge="void confirmIntegrate('merge')"
      @rebase="void confirmIntegrate('rebase')"
    />
  </aside>
</template>

<style scoped>
.sidebar-dim-enter-active,
.sidebar-dim-leave-active {
  transition: opacity 0.15s ease;
}
.sidebar-dim-enter-from,
.sidebar-dim-leave-to {
  opacity: 0;
}
</style>
