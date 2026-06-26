<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { GitCommitHorizontal, LayoutPanelLeft, PanelLeft, Rows3, X } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import GkButton from '@/components/ui/GkButton.vue'
import SettingsRow from './SettingsRow.vue'
import {
  COLUMN_LABELS,
  COMMIT_GRAPH_LIMIT_MAX,
  COMMIT_GRAPH_LIMIT_MIN,
  SECTION_KEYS,
  SECTION_LABELS,
  type CommitColumnKey,
  type SectionKey,
} from '@/lib/preferences'
import { useUiStore } from '@/stores/ui'
import { useRepositoryStore } from '@/stores/repository'

const ui = useUiStore()
const repo = useRepositoryStore()
const { leftCollapsed, rightCollapsed, settingsOpen, graphScopeAll, commitGraphLimit, fileListView } =
  storeToRefs(ui)

type SettingsCategory = 'layout' | 'changes' | 'commit-graph' | 'sidebar'

const activeCategory = ref<SettingsCategory>('layout')

const columnKeys = Object.keys(COLUMN_LABELS) as CommitColumnKey[]

const categories: { id: SettingsCategory; label: string; icon: typeof LayoutPanelLeft }[] = [
  { id: 'layout', label: 'Layout', icon: LayoutPanelLeft },
  { id: 'changes', label: 'Changes', icon: Rows3 },
  { id: 'commit-graph', label: 'Commit Graph', icon: GitCommitHorizontal },
  { id: 'sidebar', label: 'Sidebar', icon: PanelLeft },
]

const columnDescriptions: Record<CommitColumnKey, string> = {
  author: 'Show the commit author avatar and name in each row.',
  sha: 'Show the abbreviated commit hash in each row.',
  when: 'Show how long ago each commit was made.',
}

const sectionDescriptions: Partial<Record<SectionKey, string>> = {
  favorites: 'Pinned branches shown at the top of the sidebar.',
  localBranches: 'Local branch list and branch groups.',
  remoteBranches: 'Remote-tracking branches grouped by remote.',
  tags: 'Annotated and lightweight tags in the repository.',
  stashes: 'Saved stashes with message and branch context.',
  worktrees: 'Linked worktrees and their checkout paths.',
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') ui.closeSettings()
}

function refreshGraphIfOpen(): void {
  if (repo.hasOpenRepo) void repo.refreshSnapshot(['commits'])
}

function onGraphScopeAll(value: boolean): void {
  ui.setGraphScopeAll(value)
  refreshGraphIfOpen()
}

function onCommitGraphLimit(value: number): void {
  ui.setCommitGraphLimit(value)
  refreshGraphIfOpen()
}

watch(settingsOpen, (open) => {
  if (open) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
})

onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="settingsOpen"
      class="fixed inset-0 z-[190] flex items-center justify-center bg-black/55 p-6 backdrop-blur-[2px]"
      @click.self="ui.closeSettings()"
    >
      <div
        class="flex h-[min(560px,85vh)] w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-panel)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Preferences"
      >
        <!-- Sidebar nav -->
        <nav
          class="flex w-44 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-panel-raised)] py-3"
        >
          <p
            class="mb-2 px-4 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
          >
            Preferences
          </p>
          <button
            v-for="category in categories"
            :key="category.id"
            class="focus-ring mx-2 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors"
            :class="
              activeCategory === category.id
                ? 'bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent)]'
                : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]'
            "
            @click="activeCategory = category.id"
          >
            <component :is="category.icon" :size="15" class="shrink-0" />
            {{ category.label }}
          </button>
        </nav>

        <!-- Content -->
        <div class="flex min-w-0 flex-1 flex-col">
          <header
            class="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5"
          >
            <h2 class="text-sm font-semibold text-[var(--color-fg)]">
              {{ categories.find((c) => c.id === activeCategory)?.label }}
            </h2>
            <button
              class="focus-ring rounded p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
              aria-label="Close preferences"
              @click="ui.closeSettings()"
            >
              <X :size="16" />
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            <!-- Layout -->
            <template v-if="activeCategory === 'layout'">
              <p class="mb-3 px-3 text-[12px] text-[var(--color-fg-muted)]">
                Control panel visibility and restore the default three-pane layout.
              </p>
              <section class="space-y-0.5">
                <h3
                  class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                >
                  Panels
                </h3>
                <SettingsRow
                  label="Show Left Sidebar"
                  description="Display the branch sidebar on the left."
                  :model-value="!leftCollapsed"
                  @update:model-value="ui.setLeftVisible($event)"
                />
                <SettingsRow
                  label="Show Right Panel"
                  description="Display the working tree and diff panel on the right."
                  :model-value="!rightCollapsed"
                  @update:model-value="ui.setRightVisible($event)"
                />
              </section>
              <section class="mt-5 space-y-2 px-3">
                <h3
                  class="pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                >
                  Reset
                </h3>
                <p class="text-[12px] text-[var(--color-fg-muted)]">
                  Restore default panel sizes and expand both side panels.
                </p>
                <GkButton variant="secondary" size="sm" @click="ui.resetLayout()">
                  Reset Panel Layout
                </GkButton>
              </section>
            </template>

            <template v-else-if="activeCategory === 'changes'">
              <p class="mb-3 px-3 text-[12px] text-[var(--color-fg-muted)]">
                Control how changed files are listed in the working tree and commit panels.
              </p>
              <section class="space-y-0.5">
                <h3
                  class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                >
                  File list
                </h3>
                <SettingsRow
                  label="Tree view"
                  description="Group changed files in a collapsible folder hierarchy."
                  :model-value="fileListView === 'tree'"
                  @update:model-value="ui.setFileListView($event ? 'tree' : 'path')"
                />
              </section>
            </template>

            <!-- Commit Graph -->
            <template v-else-if="activeCategory === 'commit-graph'">
              <p class="mb-3 px-3 text-[12px] text-[var(--color-fg-muted)]">
                Control which commits appear in the graph and which columns are shown.
              </p>
              <section class="space-y-0.5">
                <h3
                  class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                >
                  History
                </h3>
                <SettingsRow
                  label="Show all branches"
                  description="Display commits from every branch, not just the checked-out branch."
                  :model-value="graphScopeAll"
                  @update:model-value="onGraphScopeAll($event)"
                />
                <div
                  class="flex items-start justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--color-hover)]"
                >
                  <div class="min-w-0 pt-0.5">
                    <div class="text-[13px] font-medium text-[var(--color-fg)]">
                      Recent commits to load
                    </div>
                    <p class="mt-0.5 text-[12px] leading-snug text-[var(--color-fg-muted)]">
                      Maximum number of commits fetched for the graph ({{ COMMIT_GRAPH_LIMIT_MIN }}–{{
                        COMMIT_GRAPH_LIMIT_MAX
                      }}).
                    </p>
                  </div>
                  <input
                    type="number"
                    class="focus-ring w-20 rounded-md border border-[var(--color-border)] bg-[var(--color-app)] px-2 py-1 text-right text-[13px] text-[var(--color-fg)]"
                    :min="COMMIT_GRAPH_LIMIT_MIN"
                    :max="COMMIT_GRAPH_LIMIT_MAX"
                    :value="commitGraphLimit"
                    aria-label="Recent commits to load"
                    @change="
                      onCommitGraphLimit(Number(($event.target as HTMLInputElement).value))
                    "
                  />
                </div>
              </section>
              <section class="mt-5 space-y-0.5">
                <h3
                  class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                >
                  Columns
                </h3>
                <SettingsRow
                  v-for="key in columnKeys"
                  :key="key"
                  :label="COLUMN_LABELS[key]"
                  :description="columnDescriptions[key]"
                  :model-value="ui.isColumnVisible(key)"
                  @update:model-value="ui.setColumnVisible(key, $event)"
                />
              </section>
            </template>
            <template v-else-if="activeCategory === 'sidebar'">
              <p class="mb-3 px-3 text-[12px] text-[var(--color-fg-muted)]">
                Choose which sections are expanded in the branch sidebar.
              </p>
              <section class="space-y-0.5">
                <h3
                  class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                >
                  Sections
                </h3>
                <SettingsRow
                  v-for="key in SECTION_KEYS"
                  :key="key"
                  :label="SECTION_LABELS[key]"
                  :description="sectionDescriptions[key]"
                  :model-value="ui.isSectionOpen(key)"
                  @update:model-value="ui.setSectionOpen(key, $event)"
                />
              </section>
            </template>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
