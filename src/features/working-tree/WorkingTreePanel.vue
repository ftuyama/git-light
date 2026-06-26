<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Splitpanes, Pane, type SplitpanesResizedPayload } from 'splitpanes'
import { CheckCheck, ChevronRight, Loader2, Trash2, TriangleAlert, X } from '@lucide/vue'
import IconButton from '@/components/ui/IconButton.vue'
import FileList from './FileList.vue'
import CommitDetailHeader from './CommitDetailHeader.vue'
import CompareDetailHeader from './CompareDetailHeader.vue'
import FileListViewToggle from './FileListViewToggle.vue'
import { useRepositoryStore } from '@/stores/repository'
import { useRepoDiffStore } from '@/stores/repoDiff'
import { useSelectionStore } from '@/stores/selection'
import { useUiStore } from '@/stores/ui'
import CommitBox from './CommitBox.vue'

const repo = useRepositoryStore()
const diffStore = useRepoDiffStore()
const selection = useSelectionStore()
const ui = useUiStore()
const { selectedSha, compareRange, isCompareMode } = storeToRefs(selection)
const { workingTreeChangesSize } = storeToRefs(ui)

const unstaged = computed(() => repo.unstagedFiles)
const staged = computed(() => repo.stagedFiles)
const conflicts = computed(() => repo.conflictedFiles)
const viewingCommit = computed(() => Boolean(selectedSha.value) && !isCompareMode.value)
const viewingCompare = computed(() => isCompareMode.value && compareRange.value != null)
const selectedCommit = computed(() =>
  selectedSha.value ? repo.commits.find((c) => c.sha === selectedSha.value) : undefined,
)
const showWorkingTree = computed(() => !selectedSha.value && !isCompareMode.value)
const compareFiles = computed(() => diffStore.compareFiles)
const commitFiles = computed(() => diffStore.commitFiles)

const workingTreeStagedSize = computed(() => 100 - workingTreeChangesSize.value)

const changedFileCount = computed(() => new Set(repo.workingTree.map((f) => f.path)).size)
const branchName = computed(() => repo.currentBranch?.name ?? '—')
const changesSummary = computed(() => {
  const n = changedFileCount.value
  const fileWord = n === 1 ? 'file' : 'files'
  return `${n} ${fileWord} changed on ${branchName.value}`
})
const canDiscardAll = computed(() => changedFileCount.value > 0 && conflicts.value.length === 0)

const commitEmptyMessage = 'No files changed in this commit'

function discardAllChanges(): void {
  void repo.discardAllChanges()
}
const compareEmptyMessage = 'No file changes between these commits'

function onWorkingTreeResized(payload: SplitpanesResizedPayload): void {
  const size = payload.panes[0]?.size
  if (size != null) ui.setWorkingTreeChangesSize(size)
}

function exitCompare(): void {
  selection.clearCompare()
}

watch(
  selectedSha,
  (sha) => {
    if (isCompareMode.value && compareRange.value) {
      void diffStore.loadCompareFiles(compareRange.value.fromSha, compareRange.value.toSha)
      return
    }
    if (sha) void diffStore.loadCommitFiles(sha)
    else diffStore.clearCommitFiles()
  },
  { immediate: true },
)

watch(compareRange, (range) => {
  if (range) void diffStore.loadCompareFiles(range.fromSha, range.toSha)
})
</script>

<template>
  <aside class="flex h-full flex-col border-l border-[var(--color-border)] bg-[var(--color-panel)]">
    <template v-if="viewingCompare && compareRange">
      <CompareDetailHeader
        :range="compareRange"
        :file-count="compareFiles.length"
        @close="exitCompare"
      />

      <div class="flex min-h-0 flex-1 flex-col">
        <header
          class="flex h-9 shrink-0 items-center gap-2 px-3 text-[11px] font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase"
        >
          <span class="flex-1">Changed files</span>
          <FileListViewToggle />
        </header>

        <div
          v-if="diffStore.compareFilesLoading"
          class="flex flex-1 items-center justify-center text-xs text-[var(--color-fg-subtle)]"
        >
          <Loader2 :size="16" class="mr-2 animate-spin" /> Loading files…
        </div>
        <FileList
          v-else-if="compareFiles.length"
          :key="`${compareRange.fromSha}-${compareRange.toSha}`"
          :files="compareFiles"
          readonly
        />
        <div
          v-else
          class="flex flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
        >
          {{ compareEmptyMessage }}
        </div>
      </div>
    </template>

    <template v-else-if="viewingCommit">
      <CommitDetailHeader
        v-if="selectedCommit"
        :commit="selectedCommit"
        :file-count="commitFiles.length"
      />

      <div class="flex min-h-0 flex-1 flex-col">
        <header
          class="flex h-9 shrink-0 items-center gap-2 px-3 text-[11px] font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase"
        >
          <span class="flex-1">Files</span>
          <FileListViewToggle />
        </header>

        <div
          v-if="diffStore.commitFilesLoading"
          class="flex flex-1 items-center justify-center text-xs text-[var(--color-fg-subtle)]"
        >
          <Loader2 :size="16" class="mr-2 animate-spin" /> Loading files…
        </div>
        <FileList
          v-else-if="commitFiles.length"
          :key="selectedSha ?? 'none'"
          :files="commitFiles"
          readonly
        />
        <div
          v-else
          class="flex flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
        >
          {{ commitEmptyMessage }}
        </div>
      </div>
    </template>

    <template v-if="showWorkingTree">
      <header
        class="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-2"
      >
        <IconButton
          :icon="Trash2"
          label="Discard all changes"
          danger
          tooltip-side="left"
          :disabled="!canDiscardAll"
          :busy="repo.busyAction === 'discard-all'"
          @click="discardAllChanges"
        />
        <p class="min-w-0 flex-1 truncate text-[12px] text-[var(--color-fg-muted)]">
          {{ changesSummary }}
        </p>
        <IconButton
          :icon="ChevronRight"
          label="Hide right panel"
          tooltip-side="left"
          @click="ui.toggleRight()"
        />
      </header>

      <Splitpanes
        horizontal
        class="working-tree-split min-h-0 flex-1"
        @resized="onWorkingTreeResized"
      >
        <Pane :size="workingTreeChangesSize" :min-size="20">
          <div class="flex h-full min-h-0 flex-col">
            <header
              class="flex h-9 shrink-0 items-center gap-2 px-3 text-[11px] font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase"
            >
              <span class="flex-1">Changes</span>
              <span class="font-mono text-[10px] text-[var(--color-fg-subtle)]">{{ unstaged.length }}</span>
              <FileListViewToggle />
              <button
                class="focus-ring flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-accent)] normal-case hover:bg-[var(--color-hover)] disabled:opacity-40"
                :disabled="unstaged.length === 0"
                @click="repo.stageAll()"
              >
                <CheckCheck :size="13" /> Stage All
              </button>
            </header>
            <FileList v-if="unstaged.length" :files="unstaged" />
            <div
              v-else
              class="flex flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
            >
              No unstaged changes
            </div>

            <div class="shrink-0 border-t border-[var(--color-border)]">
              <button
                class="flex h-8 w-full items-center gap-2 px-3 text-[11px] font-semibold tracking-wide uppercase"
                :class="conflicts.length ? 'text-[var(--color-danger)]' : 'text-[var(--color-fg-subtle)]'"
                :disabled="conflicts.length === 0"
                @click="ui.toggleSection('conflicts')"
              >
                <ChevronRight
                  v-if="conflicts.length"
                  :size="13"
                  class="transition-transform"
                  :class="ui.isSectionOpen('conflicts') ? 'rotate-90' : ''"
                />
                <TriangleAlert v-else :size="13" />
                <span class="flex-1 text-left">Conflicts</span>
                <span class="font-mono text-[10px]">{{ conflicts.length }}</span>
              </button>
              <div
                v-if="conflicts.length && ui.isSectionOpen('conflicts')"
                class="max-h-40 overflow-y-auto px-1 pb-1"
              >
                <FileList :files="conflicts" />
              </div>
            </div>
          </div>
        </Pane>

        <Pane :size="workingTreeStagedSize" :min-size="15">
          <div class="flex h-full min-h-0 flex-col">
            <header
              class="flex h-9 shrink-0 items-center gap-2 px-3 text-[11px] font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase"
            >
              <span class="flex-1">Staged</span>
              <span class="font-mono text-[10px] text-[var(--color-fg-subtle)]">{{ staged.length }}</span>
              <FileListViewToggle />
              <button
                class="focus-ring flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-fg-muted)] normal-case hover:bg-[var(--color-hover)] disabled:opacity-40"
                :disabled="staged.length === 0"
                @click="repo.unstageAll()"
              >
                <X :size="13" /> Unstage All
              </button>
            </header>
            <FileList v-if="staged.length" :files="staged" />
            <div
              v-else
              class="flex flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-fg-subtle)]"
            >
              Stage files to commit them
            </div>
          </div>
        </Pane>
      </Splitpanes>

      <CommitBox />
    </template>
  </aside>
</template>
