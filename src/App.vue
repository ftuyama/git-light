<script setup lang="ts">
import { computed, ref } from 'vue'
import { Splitpanes, Pane, type SplitpanesResizedPayload } from 'splitpanes'
import { TooltipProvider } from 'reka-ui'
import { storeToRefs } from 'pinia'
import Toolbar from '@/features/toolbar/Toolbar.vue'
import BranchSidebar from '@/features/branch-sidebar/BranchSidebar.vue'
import CommitGraph from '@/features/commit-graph/CommitGraph.vue'
import WorkingTreePanel from '@/features/working-tree/WorkingTreePanel.vue'
import StatusBar from '@/features/status-bar/StatusBar.vue'
import SidebarRail from '@/features/layout/SidebarRail.vue'
import ToastViewport from '@/features/layout/ToastViewport.vue'
import StartupView from '@/features/startup/StartupView.vue'
import OperationBanner from '@/features/layout/OperationBanner.vue'
import PromptHost from '@/features/layout/PromptHost.vue'
import SearchOverlay from '@/features/search/SearchOverlay.vue'
import InteractiveRebaseDialog from '@/features/rebase/InteractiveRebaseDialog.vue'
import AppSettingsDialog from '@/features/settings/AppSettingsDialog.vue'
import { useUiStore } from '@/stores/ui'
import { useSelectionStore } from '@/stores/selection'
import { useRepositoryStore } from '@/stores/repository'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'

const ui = useUiStore()
const repo = useRepositoryStore()
const selection = useSelectionStore()
const { leftSize, rightSize, leftCollapsed, rightCollapsed } = storeToRefs(ui)
const { screen } = storeToRefs(repo)

const branchSidebar = ref<InstanceType<typeof BranchSidebar>>()

const presentPanes = computed(() => {
  const keys: ('left' | 'center' | 'right')[] = []
  if (!leftCollapsed.value) keys.push('left')
  keys.push('center')
  if (!rightCollapsed.value) keys.push('right')
  return keys
})

const centerSize = computed(
  () =>
    100 -
    (leftCollapsed.value ? 0 : leftSize.value) -
    (rightCollapsed.value ? 0 : rightSize.value),
)

function onResized(payload: SplitpanesResizedPayload): void {
  presentPanes.value.forEach((key, index) => {
    const size = payload.panes[index]?.size
    if (size == null) return
    if (key === 'left') ui.setLeftSize(size)
    if (key === 'right') ui.setRightSize(size)
  })
}

useKeyboardShortcuts([
  { key: 'f', meta: true, handler: () => branchSidebar.value?.focusSearch() },
  { key: 'f', meta: true, shift: true, handler: () => repo.openSearch() },
  { key: 't', meta: true, handler: () => void repo.runAction({ kind: 'open-terminal' }) },
  { key: 'r', meta: true, handler: () => void repo.runAction({ kind: 'refresh' }) },
  { key: 'z', meta: true, handler: () => { if (repo.canUndo) void repo.runAction({ kind: 'undo' }) } },
  { key: 'z', meta: true, shift: true, handler: () => { if (repo.canRedo) void repo.runAction({ kind: 'redo' }) } },
  { key: 'arrowdown', handler: () => selection.moveBy(1) },
  { key: 'arrowup', handler: () => selection.moveBy(-1) },
  { key: 'j', handler: () => selection.moveBy(1) },
  { key: 'k', handler: () => selection.moveBy(-1) },
  { key: 'b', meta: true, handler: () => ui.toggleLeft() },
])
</script>

<template>
  <StartupView v-if="screen === 'startup'" />

  <TooltipProvider v-else :delay-duration="320" :skip-delay-duration="120">
    <div class="flex h-screen w-screen flex-col overflow-hidden bg-[var(--color-app)]">
      <Toolbar />
      <OperationBanner />

      <div class="flex min-h-0 flex-1">
        <SidebarRail v-if="leftCollapsed" side="left" @expand="ui.toggleLeft()" />

        <Splitpanes class="min-w-0 flex-1" @resized="onResized">
          <Pane v-if="!leftCollapsed" :size="leftSize" :min-size="14" :max-size="36">
            <BranchSidebar ref="branchSidebar" />
          </Pane>
          <Pane :size="centerSize" :min-size="30">
            <CommitGraph />
          </Pane>
          <Pane v-if="!rightCollapsed" :size="rightSize" :min-size="16" :max-size="44">
            <WorkingTreePanel />
          </Pane>
        </Splitpanes>

        <SidebarRail v-if="rightCollapsed" side="right" @expand="ui.toggleRight()" />
      </div>

      <StatusBar />
    </div>
    <ToastViewport />
    <PromptHost />
    <SearchOverlay />
    <InteractiveRebaseDialog />
  </TooltipProvider>

  <AppSettingsDialog />
</template>
