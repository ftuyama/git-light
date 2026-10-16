<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Splitpanes, Pane, type SplitpanesResizePayload, type SplitpanesResizedPayload } from 'splitpanes'
import { TooltipProvider } from 'reka-ui'
import { storeToRefs } from 'pinia'
import Toolbar from '@/features/toolbar/Toolbar.vue'
import RepoTabs from '@/features/toolbar/RepoTabs.vue'
import BranchSidebar from '@/features/branch-sidebar/BranchSidebar.vue'
import CommitGraph from '@/features/commit-graph/CommitGraph.vue'
import WorkingTreePanel from '@/features/working-tree/WorkingTreePanel.vue'
import StatusBar from '@/features/status-bar/StatusBar.vue'
import SidebarRail from '@/features/layout/SidebarRail.vue'
import ToastViewport from '@/features/layout/ToastViewport.vue'
import StartupView from '@/features/startup/StartupView.vue'
import OperationBanner from '@/features/layout/OperationBanner.vue'
import PromptHost from '@/features/layout/PromptHost.vue'
import CommandPalette from '@/features/palette/CommandPalette.vue'
import SearchOverlay from '@/features/search/SearchOverlay.vue'
import FileHistoryDialog from '@/features/working-tree/FileHistoryDialog.vue'
import GitOutputDrawer from '@/features/layout/GitOutputDrawer.vue'
import InteractiveRebaseDialog from '@/features/rebase/InteractiveRebaseDialog.vue'
import AppSettingsDialog from '@/features/settings/AppSettingsDialog.vue'
import BlameOverlay from '@/features/diff/BlameOverlay.vue'
import {
  LEFT_SIDEBAR_COLLAPSE_SIZE,
  LEFT_SIDEBAR_SIZE_MAX,
  RIGHT_SIDEBAR_COLLAPSE_SIZE,
  RIGHT_SIDEBAR_SIZE_MAX,
  shouldShowLeftSidebarCollapseHint,
  shouldShowRightSidebarCollapseHint,
} from '@/lib/preferences'
import { useUiStore } from '@/stores/ui'
import { useSelectionStore } from '@/stores/selection'
import { useRepositoryStore } from '@/stores/repository'
import { useRepoDiffStore } from '@/stores/repoDiff'
import { useRepoTabsStore } from '@/stores/repoTabs'
import { useToastStore } from '@/stores/toast'
import { useKeyboardShortcuts, type ShortcutHandler } from '@/composables/useKeyboardShortcuts'
import { COMMAND_META, type CommandId } from '@/lib/keybindings'
import { useCommitGraphZoom } from '@/features/commit-graph/composables/useCommitGraphZoom'

const ui = useUiStore()
const repo = useRepositoryStore()
const selection = useSelectionStore()
const diffStore = useRepoDiffStore()
const tabsStore = useRepoTabsStore()
const toast = useToastStore()
const graphZoom = useCommitGraphZoom()
const { leftSize, rightSize, leftCollapsed, rightCollapsed, leftCollapseHint, rightCollapseHint, suppressPaneAnimation } =
  storeToRefs(ui)
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

const showBlameOverlay = computed(
  () =>
    diffStore.panelMode === 'blame' &&
    Boolean(diffStore.selectedFilePath) &&
    !diffStore.selectedFileIsConflicted,
)

const isFileDiffActive = computed(() => diffStore.selectedFilePath !== null)

let paneInstantTimer: ReturnType<typeof setTimeout> | undefined

watch(isFileDiffActive, (active, previous) => {
  if (active && !previous) ui.autoCollapseLeftForDiff()
  else if (!active && previous) ui.restoreLeftAfterDiff()
  else return
  // Keep the instant-snap class for one paint cycle past the 0.2s
  // splitpanes width transition so only the auto-toggle skips animation.
  clearTimeout(paneInstantTimer)
  paneInstantTimer = setTimeout(() => {
    ui.suppressPaneAnimation = false
  }, 250)
})

function onResize(payload: SplitpanesResizePayload): void {
  presentPanes.value.forEach((key, index) => {
    const size = payload.panes[index]?.size
    if (size == null) return
    if (key === 'left') {
      ui.setLeftCollapseHint(shouldShowLeftSidebarCollapseHint(size, leftSize.value))
    }
    if (key === 'right') {
      ui.setRightCollapseHint(shouldShowRightSidebarCollapseHint(size, rightSize.value))
    }
  })
}

function onResized(payload: SplitpanesResizedPayload): void {
  ui.clearSidebarCollapseHints()
  presentPanes.value.forEach((key, index) => {
    const size = payload.panes[index]?.size
    if (size == null) return
    if (key === 'left') ui.setLeftSize(size)
    if (key === 'right') ui.setRightSize(size)
  })
}

async function switchToTab(path: string | null): Promise<void> {
  if (!path) return
  try {
    const ok = await repo.switchRepository(path)
    if (!ok) toast.push(`Could not open ${path}.`, 'error')
  } catch (err) {
    console.error('[git-light] switch tab failed:', err)
    toast.push(`Could not open ${path}.`, 'error')
  }
}

async function closeActiveTab(): Promise<void> {
  const active = tabsStore.activePath
  if (!active) return
  const nextPath = tabsStore.removeTab(active)
  void repo.removeRecent(active)
  if (nextPath) await switchToTab(nextPath)
  else await repo.closeRepository()
}

async function reopenTab(): Promise<void> {
  const restored = tabsStore.reopenLastClosed()
  if (!restored) return
  await switchToTab(restored.path)
}

const dynamicShortcuts = computed<ShortcutHandler[]>(() => {
  const keymap = ui.keybindings
  const out: ShortcutHandler[] = []
  const push = (id: CommandId, handler: (event: KeyboardEvent) => void): void => {
    const allowInInput = COMMAND_META[id].allowInInput
    for (const binding of keymap[id] ?? []) {
      out.push({
        key: binding.key,
        meta: binding.ctrlMeta,
        shift: binding.shift,
        alt: binding.alt,
        allowInInput,
        handler,
      })
    }
  }

  push('focusSidebarSearch', () => branchSidebar.value?.focusSearch())
  push('globalSearch', () => repo.openSearch())
  push('commandPalette', () => ui.toggleCommandPalette())
  push('openTerminal', () => void repo.runAction({ kind: 'open-terminal' }))
  push('refresh', () => void repo.runAction({ kind: 'refresh' }))
  push('pull', () => void repo.runAction({ kind: 'pull' }))
  push('push', () => void repo.runAction({ kind: 'push' }))
  push('undo', () => { if (repo.canUndo) void repo.runAction({ kind: 'undo' }) })
  push('redo', () => { if (repo.canRedo) void repo.runAction({ kind: 'redo' }) })
  push('graphNavDown', () => selection.moveBy(1))
  push('graphNavUp', () => selection.moveBy(-1))
  push('toggleLeftSidebar', () => ui.toggleLeft())
  push('graphZoomIn', () => graphZoom.zoomIn())
  push('graphZoomOut', () => graphZoom.zoomOut())
  push('graphZoomReset', () => graphZoom.resetZoom())
  push('nextTab', () => void switchToTab(tabsStore.cycleTab(1)))
  push('prevTab', () => void switchToTab(tabsStore.cycleTab(-1)))
  push('switchTab1', () => void switchToTab(tabsStore.switchToIndex(0)))
  push('switchTab2', () => void switchToTab(tabsStore.switchToIndex(1)))
  push('switchTab3', () => void switchToTab(tabsStore.switchToIndex(2)))
  push('switchTab4', () => void switchToTab(tabsStore.switchToIndex(3)))
  push('switchTab5', () => void switchToTab(tabsStore.switchToIndex(4)))
  push('switchTab6', () => void switchToTab(tabsStore.switchToIndex(5)))
  push('switchTab7', () => void switchToTab(tabsStore.switchToIndex(6)))
  push('switchTab8', () => void switchToTab(tabsStore.switchToIndex(7)))
  push('switchTabLast', () => void switchToTab(tabsStore.switchToLast()))
  push('newTab', () => void repo.pickAndOpenRepository())
  push('closeTab', () => void closeActiveTab())
  push('reopenClosedTab', () => void reopenTab())
  return out
})

useKeyboardShortcuts(dynamicShortcuts)
</script>

<template>
  <TooltipProvider :delay-duration="320" :skip-delay-duration="120">
    <StartupView v-if="screen === 'startup'" />

    <template v-else>
    <div class="flex h-screen w-screen flex-col overflow-hidden bg-[var(--color-app)]">
      <RepoTabs />
      <Toolbar />
      <OperationBanner />

      <div class="relative flex min-h-0 flex-1">
        <SidebarRail v-if="leftCollapsed" side="left" @expand="ui.toggleLeft()" />

        <Splitpanes
          class="min-w-0 flex-1"
          :class="{
            'splitpanes--collapse-hint-left': leftCollapseHint,
            'splitpanes--collapse-hint-right': rightCollapseHint,
            'splitpanes--instant': suppressPaneAnimation,
          }"
          @resize="onResize"
          @resized="onResized"
        >
          <Pane
            v-if="!leftCollapsed"
            :size="leftSize"
            :min-size="LEFT_SIDEBAR_COLLAPSE_SIZE"
            :max-size="LEFT_SIDEBAR_SIZE_MAX"
          >
            <BranchSidebar ref="branchSidebar" />
          </Pane>
          <Pane :size="centerSize" :min-size="30">
            <CommitGraph />
          </Pane>
          <Pane
            v-if="!rightCollapsed"
            :size="rightSize"
            :min-size="RIGHT_SIDEBAR_COLLAPSE_SIZE"
            :max-size="RIGHT_SIDEBAR_SIZE_MAX"
          >
            <WorkingTreePanel />
          </Pane>
        </Splitpanes>

        <SidebarRail v-if="rightCollapsed" side="right" @expand="ui.toggleRight()" />

        <BlameOverlay v-if="showBlameOverlay" />
      </div>

      <GitOutputDrawer />
      <StatusBar />
    </div>
    <ToastViewport />
    <PromptHost />
    <CommandPalette />
    <SearchOverlay />
    <FileHistoryDialog />
    <InteractiveRebaseDialog />
    </template>

    <AppSettingsDialog />
  </TooltipProvider>
</template>
