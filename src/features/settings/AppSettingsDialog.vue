<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { GitCommitHorizontal, Heart, Keyboard, LayoutPanelLeft, Palette, PanelLeft, PenLine, RefreshCw, Rows3, X } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import Button from '@/components/ui/Button.vue'
import SettingsCreditsPanel from './SettingsCreditsPanel.vue'
import SettingsRow from './SettingsRow.vue'
import SettingsSegmentedRow from './SettingsSegmentedRow.vue'
import ThemePicker from './ThemePicker.vue'
import UiModePicker from './UiModePicker.vue'
import ShortcutRecorder from './ShortcutRecorder.vue'
import {
  COMMAND_IDS,
  COMMAND_META,
  bindingSignature,
  findConflicts,
  type CommandId,
  type KeyBinding,
} from '@/lib/keybindings'
import {
  ADVANCED_SECTION_KEYS,
  AUTO_FETCH_INTERVAL_OPTIONS,
  COLUMN_LABELS,
  COLUMN_WIDTH_LABELS,
  COLUMN_WIDTH_LIMITS,
  COMMIT_GRAPH_LIMIT_MAX,
  COMMIT_GRAPH_LIMIT_MIN,
  SECTION_KEYS,
  SECTION_LABELS,
  SIDEBAR_SECTION_STATE_LABELS,
  SIDEBAR_SECTION_STATES,
  formatAutoFetchInterval,
  type CommitColumnKey,
  type CommitColumnWidthKey,
  type SectionKey,
  type SidebarSectionState,
} from '@/lib/preferences'
import { useUiStore } from '@/stores/ui'
import { useRepositoryStore } from '@/stores/repository'

const ui = useUiStore()
const repo = useRepositoryStore()
const { leftCollapsed, rightCollapsed, settingsOpen, graphScopeAll, commitGraphLimit, fileListView, theme, uiMode, signOffCommit, signCommit, autoFetchIntervalSec } =
  storeToRefs(ui)

type SettingsCategory = 'appearance' | 'layout' | 'changes' | 'commits' | 'commit-graph' | 'sidebar' | 'sync' | 'shortcuts' | 'credits'

const activeCategory = ref<SettingsCategory>('appearance')

const columnKeys = Object.keys(COLUMN_LABELS) as CommitColumnKey[]
const columnWidthKeys = Object.keys(COLUMN_WIDTH_LABELS) as CommitColumnWidthKey[]

const sectionStateOptions = SIDEBAR_SECTION_STATES.map((state) => ({
  value: state,
  label: SIDEBAR_SECTION_STATE_LABELS[state],
}))

const sidebarSectionKeys = computed(() =>
  ui.isAdvanced
    ? [...SECTION_KEYS]
    : SECTION_KEYS.filter((key) => !ADVANCED_SECTION_KEYS.includes(key as (typeof ADVANCED_SECTION_KEYS)[number])),
)

interface SettingsCategoryItem {
  id: SettingsCategory
  label: string
  icon: typeof LayoutPanelLeft
}

interface SettingsGroup {
  label: string
  items: SettingsCategoryItem[]
}

const preferenceGroups: SettingsGroup[] = [
  {
    label: 'General',
    items: [
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'layout', label: 'Layout', icon: LayoutPanelLeft },
    ],
  },
  {
    label: 'UI',
    items: [
      { id: 'commit-graph', label: 'Commit Graph', icon: GitCommitHorizontal },
      { id: 'sidebar', label: 'Sidebar', icon: PanelLeft },
    ],
  },
  {
    label: 'Repository',
    items: [
      { id: 'changes', label: 'Changes', icon: Rows3 },
      { id: 'commits', label: 'Commits', icon: PenLine },
      { id: 'sync', label: 'Sync', icon: RefreshCw },
    ],
  },
  {
    label: 'Application',
    items: [
      { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
      { id: 'credits', label: 'Credits', icon: Heart },
    ],
  },
]

const categories = preferenceGroups.flatMap((group) => group.items)

const visibleShortcutGroups = computed(() => {
  const groups = new Map<string, CommandId[]>()
  for (const id of COMMAND_IDS) {
    const meta = COMMAND_META[id]
    if (meta.advanced && !ui.isAdvanced) continue
    const list = groups.get(meta.category) ?? []
    list.push(id)
    groups.set(meta.category, list)
  }
  return [...groups.entries()]
})

const conflictSignatures = computed(() => new Set(findConflicts(ui.keybindings).keys()))

function isConflicted(id: CommandId): boolean {
  return (ui.keybindings[id] ?? []).some((x) => conflictSignatures.value.has(bindingSignature(x)))
}

function conflictNames(id: CommandId): string {
  const sigs = new Map<string, CommandId[]>(findConflicts(ui.keybindings))
  const names = new Set<string>()
  for (const binding of ui.keybindings[id] ?? []) {
    for (const other of sigs.get(bindingSignature(binding)) ?? []) {
      if (other !== id) names.add(COMMAND_META[other].title)
    }
  }
  return [...names].join(', ')
}

function onCapture(id: CommandId, binding: KeyBinding): void {
  ui.setBinding(id, binding)
}

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

function onSectionState(key: SectionKey, state: string): void {
  ui.setSectionState(key, state as SidebarSectionState)
}

function onColumnWidth(key: CommitColumnWidthKey, value: number): void {
  ui.setColumnWidth(key, value)
}

function columnWidthHint(key: CommitColumnWidthKey): string {
  const { min, max } = COLUMN_WIDTH_LIMITS[key]
  const range = `${min}–${max} px`
  if (key === 'refs' || key === 'graph' || key === 'commit') return range
  return ui.isColumnVisible(key) ? range : `${range} · hidden`
}

function onAutoFetchIntervalSec(value: number): void {
  ui.setAutoFetchIntervalSec(value)
  // Apply immediately: restart the background timer with the new delay.
  if (repo.hasOpenRepo) repo.restartAutoFetch()
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
          class="flex w-44 shrink-0 flex-col overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-panel-raised)] py-3"
        >
          <div
            v-for="group in preferenceGroups"
            :key="group.label"
            class="mt-5 first:mt-0"
          >
            <p
              class="mb-1 px-4 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
            >
              {{ group.label }}
            </p>
            <button
              v-for="category in group.items"
              :key="category.id"
              class="focus-ring mx-2 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors"
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
          </div>
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
            <!-- Appearance -->
            <template v-if="activeCategory === 'appearance'">
              <section class="mb-6 px-3">
                <h3
                  class="pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                >
                  Interface
                </h3>
                <p class="mb-3 text-[12px] text-[var(--color-fg-muted)]">
                  Basic hides advanced actions like stash, rebase, and terminal. Advanced shows
                  everything.
                </p>
                <UiModePicker :model-value="uiMode" />
              </section>
              <p class="mb-3 px-3 text-[12px] text-[var(--color-fg-muted)]">
                Choose a color palette for the application interface.
              </p>
              <section class="px-3">
                <ThemePicker :model-value="theme" />
              </section>
            </template>

            <!-- Layout -->
            <template v-else-if="activeCategory === 'layout'">
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
                <Button variant="secondary" size="sm" @click="ui.resetLayout()">
                  Reset Panel Layout
                </Button>
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

            <template v-else-if="activeCategory === 'commits'">
              <p class="mb-3 px-3 text-[12px] text-[var(--color-fg-muted)]">
                Default options applied to new commits.
              </p>
              <section class="space-y-0.5">
                <h3
                  class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                >
                  Commit options
                </h3>
                <SettingsRow
                  label="Sign off commit"
                  description="Add a Signed-off-by trailer to commit messages (--signoff)."
                  :model-value="signOffCommit"
                  @update:model-value="ui.setSignOffCommit($event)"
                />
                <SettingsRow
                  label="Sign commit (GPG/SSH)"
                  description="Sign with GPG/SSH key (-S). Requires user.signingkey in git config."
                  :model-value="signCommit"
                  @update:model-value="ui.setSignCommit($event)"
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
                <p class="px-3 pb-1 text-[12px] text-[var(--color-fg-muted)]">
                  Choose which optional columns are shown in the graph rows.
                </p>
                <SettingsRow
                  v-for="key in columnKeys"
                  :key="key"
                  :label="COLUMN_LABELS[key]"
                  :description="columnDescriptions[key]"
                  :model-value="ui.isColumnVisible(key)"
                  @update:model-value="ui.setColumnVisible(key, $event)"
                />
              </section>
              <section class="mt-5 space-y-0.5">
                <div class="flex items-center justify-between gap-3 px-3 pb-1">
                  <h3
                    class="text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                  >
                    Column widths
                  </h3>
                  <Button variant="secondary" size="sm" @click="ui.resetColumnWidths()">
                    Reset widths
                  </Button>
                </div>
                <p class="px-3 pb-1 text-[12px] text-[var(--color-fg-muted)]">
                  Exact pixel widths, or drag the column edges in the graph header.
                </p>
                <div
                  v-for="key in columnWidthKeys"
                  :key="key"
                  class="flex items-center justify-between gap-4 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--color-hover)]"
                >
                  <div class="min-w-0">
                    <div class="text-[13px] font-medium text-[var(--color-fg)]">
                      {{ COLUMN_WIDTH_LABELS[key] }}
                    </div>
                    <p class="mt-0.5 text-[12px] leading-snug text-[var(--color-fg-muted)]">
                      {{ columnWidthHint(key) }}
                    </p>
                  </div>
                  <input
                    type="number"
                    class="focus-ring w-20 shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-app)] px-2 py-1 text-right text-[13px] text-[var(--color-fg)]"
                    :min="COLUMN_WIDTH_LIMITS[key].min"
                    :max="COLUMN_WIDTH_LIMITS[key].max"
                    :value="ui.columnWidths[key]"
                    :aria-label="`${COLUMN_WIDTH_LABELS[key]} column width`"
                    @change="
                      onColumnWidth(key, Number(($event.target as HTMLInputElement).value))
                    "
                  />
                </div>
              </section>
            </template>
            <template v-else-if="activeCategory === 'sidebar'">
              <p class="mb-3 px-3 text-[12px] text-[var(--color-fg-muted)]">
                Choose how each branch sidebar section is shown: expanded, collapsed to its header,
                or hidden entirely.
              </p>
              <section class="space-y-0.5">
                <h3
                  class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                >
                  Sections
                </h3>
                <SettingsSegmentedRow
                  v-for="key in sidebarSectionKeys"
                  :key="key"
                  :label="SECTION_LABELS[key]"
                  :description="sectionDescriptions[key]"
                  :model-value="ui.sectionState(key)"
                  :options="sectionStateOptions"
                  @update:model-value="onSectionState(key, $event)"
                />
              </section>
            </template>

            <template v-else-if="activeCategory === 'sync'">
              <p class="mb-3 px-3 text-[12px] text-[var(--color-fg-muted)]">
                Keep remote-tracking branches fresh without leaving the app.
              </p>
              <section class="space-y-0.5">
                <h3
                  class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                >
                  Background fetch
                </h3>
                <div
                  class="flex items-start justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--color-hover)]"
                >
                  <div class="min-w-0 pt-0.5">
                    <div class="text-[13px] font-medium text-[var(--color-fg)]">
                      Auto-fetch interval
                    </div>
                    <p class="mt-0.5 text-[12px] leading-snug text-[var(--color-fg-muted)]">
                      Silently fetch all remotes on a schedule. No banner, no toast — the
                      graph just updates.
                    </p>
                  </div>
                  <select
                    class="focus-ring shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-app)] px-2 py-1 text-[13px] text-[var(--color-fg)]"
                    :value="autoFetchIntervalSec"
                    aria-label="Auto-fetch interval"
                    @change="
                      onAutoFetchIntervalSec(Number(($event.target as HTMLSelectElement).value))
                    "
                  >
                    <option
                      v-for="option in AUTO_FETCH_INTERVAL_OPTIONS"
                      :key="option"
                      :value="option"
                    >
                      {{ formatAutoFetchInterval(option) }}
                    </option>
                  </select>
                </div>
              </section>
            </template>

            <template v-else-if="activeCategory === 'shortcuts'">
              <div class="mb-3 flex items-start justify-between gap-3 px-3">
                <p class="text-[12px] text-[var(--color-fg-muted)]">
                  Click a shortcut to record a new one. Esc cancels. Conflicts are highlighted.
                </p>
                <Button variant="secondary" size="sm" class="shrink-0" @click="ui.resetAllKeybindings()">
                  Restore defaults
                </Button>
              </div>
              <section v-for="[group, ids] in visibleShortcutGroups" :key="group" class="mb-4 space-y-0.5">
                <h3
                  class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                >
                  {{ group }}
                </h3>
                <div
                  v-for="id in ids"
                  :key="id"
                  class="flex items-center justify-between gap-4 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--color-hover)]"
                >
                  <div class="min-w-0">
                    <div class="text-[13px] text-[var(--color-fg)]">{{ COMMAND_META[id].title }}</div>
                    <div v-if="isConflicted(id)" class="mt-0.5 text-[11px] text-[var(--color-danger)]">
                      Conflicts with: {{ conflictNames(id) }}
                    </div>
                  </div>
                  <div class="flex shrink-0 items-center gap-1.5">
                    <ShortcutRecorder
                      :bindings="ui.keybindings[id]"
                      @capture="(binding) => onCapture(id, binding)"
                    />
                    <button
                      v-if="ui.keybindings[id]?.length"
                      class="focus-ring rounded px-1.5 py-0.5 text-[11px] text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
                      :aria-label="`Disable ${COMMAND_META[id].title} shortcut`"
                      title="Disable (clear shortcut)"
                      @click="ui.clearBinding(id)"
                    >
                      ×
                    </button>
                    <button
                      class="focus-ring rounded px-1.5 py-0.5 text-[11px] text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
                      :aria-label="`Reset ${COMMAND_META[id].title} shortcut`"
                      title="Reset to default"
                      @click="ui.resetBinding(id)"
                    >
                      ↺
                    </button>
                  </div>
                </div>
              </section>
            </template>

            <template v-else-if="activeCategory === 'credits'">
              <SettingsCreditsPanel />
            </template>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
