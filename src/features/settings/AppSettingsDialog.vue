<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { Check, ChevronRight, GitCommitHorizontal, Heart, Keyboard, LayoutPanelLeft, Palette, PanelLeft, PenLine, RefreshCw, Rows3, Search, X } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/Button.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import SettingsCreditsPanel from './SettingsCreditsPanel.vue'
import SettingsRow from './SettingsRow.vue'
import SettingsSegmentedRow from './SettingsSegmentedRow.vue'
import ThemePicker from './ThemePicker.vue'
import UiModePicker from './UiModePicker.vue'
import ShortcutRecorder from './ShortcutRecorder.vue'
import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from '@/lib/locales'
import {
  SETTINGS_CATEGORY_KEYS,
  buildSettingsSearchEntries,
  searchSettings,
  type SettingsCategory,
  type SettingsSearchEntry,
} from './settingsSearch'
import {
  COMMAND_IDS,
  COMMAND_META,
  bindingSignature,
  commandCategoryKey,
  findConflicts,
  type CommandCategory,
  type CommandId,
  type KeyBinding,
} from '@/lib/keybindings'
import {
  ADVANCED_SECTION_KEYS,
  AUTO_FETCH_INTERVAL_OPTIONS,
  COLUMN_LABEL_KEYS,
  COLUMN_WIDTH_LABEL_KEYS,
  COLUMN_WIDTH_LIMITS,
  COMMIT_GRAPH_LIMIT_MIN,
  COMMIT_GRAPH_LIMIT_RECOMMENDED,
  FONT_SCALE_OPTIONS,
  SECTION_KEYS,
  SECTION_LABEL_KEYS,
  SIDEBAR_SECTION_STATE_LABEL_KEYS,
  SIDEBAR_SECTION_STATES,
  type CommitColumnKey,
  type CommitColumnWidthKey,
  type SectionKey,
  type SidebarSectionState,
} from '@/lib/preferences'
import { useUiStore } from '@/stores/ui'
import { useRepositoryStore } from '@/stores/repository'
import { clearAvatarCache } from '@/lib/avatarCache'
import { resetGithubAuthorSync, syncGithubAuthors } from '@/lib/githubAvatarSync'

const { t } = useI18n()
const ui = useUiStore()
const repo = useRepositoryStore()
const { leftCollapsed, rightCollapsed, settingsOpen, graphScopeAll, commitGraphLimit, fileListView, theme, fontScale, uiMode, signOffCommit, signCommit, remoteAvatars, autoFetchIntervalSec } =
  storeToRefs(ui)

const activeCategory = ref<SettingsCategory>('appearance')

const columnKeys = Object.keys(COLUMN_LABEL_KEYS) as CommitColumnKey[]
const columnWidthKeys = Object.keys(COLUMN_WIDTH_LABEL_KEYS) as CommitColumnWidthKey[]

const sectionStateOptions = computed(() =>
  SIDEBAR_SECTION_STATES.map((state) => ({
    value: state,
    label: t(SIDEBAR_SECTION_STATE_LABEL_KEYS[state]),
  })),
)

/** Percent labels are locale-independent; only the row label/description translate. */
const fontScaleOptions = FONT_SCALE_OPTIONS.map((value) => ({
  value: String(value),
  label: `${Math.round(value * 100)}%`,
}))

const sidebarSectionKeys = computed(() =>
  ui.isAdvanced
    ? [...SECTION_KEYS]
    : SECTION_KEYS.filter((key) => !ADVANCED_SECTION_KEYS.includes(key as (typeof ADVANCED_SECTION_KEYS)[number])),
)

interface SettingsCategoryItem {
  id: SettingsCategory
  icon: typeof LayoutPanelLeft
}

interface SettingsGroup {
  label: string
  items: SettingsCategoryItem[]
}

const preferenceGroups: SettingsGroup[] = [
  {
    label: 'settings.categories.general',
    items: [
      { id: 'appearance', icon: Palette },
      { id: 'layout', icon: LayoutPanelLeft },
    ],
  },
  {
    label: 'settings.categories.ui',
    items: [
      { id: 'commit-graph', icon: GitCommitHorizontal },
      { id: 'sidebar', icon: PanelLeft },
    ],
  },
  {
    label: 'settings.categories.repository',
    items: [
      { id: 'changes', icon: Rows3 },
      { id: 'commits', icon: PenLine },
      { id: 'sync', icon: RefreshCw },
    ],
  },
  {
    label: 'settings.categories.application',
    items: [
      { id: 'shortcuts', icon: Keyboard },
      { id: 'credits', icon: Heart },
    ],
  },
]

const searchQuery = ref('')
const searchExpanded = ref(false)
const searchInput = ref<InstanceType<typeof SearchInput>>()
const isSearching = computed(() => searchQuery.value.trim().length > 0)

const searchEntries = computed(() => {
  // Rebuild when the language changes so results follow the active catalog.
  void ui.resolvedLocale
  return buildSettingsSearchEntries({ isAdvanced: ui.isAdvanced })
})
const searchGroups = computed(() => searchSettings(searchEntries.value, searchQuery.value))
const searchResultCount = computed(() =>
  searchGroups.value.reduce((total, group) => total + group.entries.length, 0),
)

const headerTitle = computed(() =>
  isSearching.value
    ? t('settings.search.title')
    : t(SETTINGS_CATEGORY_KEYS[activeCategory.value]),
)

function selectCategory(category: SettingsCategory): void {
  activeCategory.value = category
  searchQuery.value = ''
}

function openSearch(): void {
  searchExpanded.value = true
  void nextTick(() => searchInput.value?.focus())
}

function collapseSearch(): void {
  searchQuery.value = ''
  searchExpanded.value = false
}

let highlightTimer: ReturnType<typeof setTimeout> | undefined

async function goToSetting(entry: SettingsSearchEntry): Promise<void> {
  selectCategory(entry.category)
  if (!entry.anchor) return
  await nextTick()
  const element = document.getElementById(entry.anchor)
  if (!element) return
  element.scrollIntoView({ block: 'center' })
  element.classList.add('settings-anchor-highlight')
  clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => element.classList.remove('settings-anchor-highlight'), 1600)
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    element.isContentEditable
  )
}

function onSearchKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    if ((event.target as HTMLElement | null)?.tagName !== 'INPUT') return
    const first = searchGroups.value[0]?.entries[0]
    if (!first) return
    event.preventDefault()
    void goToSetting(first)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    if (isSearching.value) searchQuery.value = ''
    else collapseSearch()
  }
}

const visibleShortcutGroups = computed(() => {
  const groups = new Map<CommandCategory, CommandId[]>()
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
      if (other !== id) names.add(t(COMMAND_META[other].titleKey))
    }
  }
  return t('settings.shortcuts.conflictsWith', { names: [...names].join(', ') })
}

function onCapture(id: CommandId, binding: KeyBinding): void {
  ui.setBinding(id, binding)
}

const columnDescriptions: Record<CommitColumnKey, string> = {
  author: 'settings.columnDescriptions.author',
  sha: 'settings.columnDescriptions.sha',
  when: 'settings.columnDescriptions.when',
}

const sectionDescriptions: Partial<Record<SectionKey, string>> = {
  favorites: 'settings.sectionDescriptions.favorites',
  localBranches: 'settings.sectionDescriptions.localBranches',
  remoteBranches: 'settings.sectionDescriptions.remoteBranches',
  tags: 'settings.sectionDescriptions.tags',
  stashes: 'settings.sectionDescriptions.stashes',
  worktrees: 'settings.sectionDescriptions.worktrees',
}

function sectionDescription(key: SectionKey): string {
  const descriptionKey = sectionDescriptions[key]
  return descriptionKey ? t(descriptionKey) : ''
}

interface LanguageOption {
  /** `null` follows the OS/browser locale. */
  value: AppLocale | null
  label: string
  description?: string
}

const languageOptions = computed<LanguageOption[]>(() => [
  {
    value: null,
    label: t('settings.language.system'),
    description: t('settings.language.systemDescription', {
      language: LOCALE_LABELS[ui.resolvedLocale],
    }),
  },
  ...APP_LOCALES.map((code) => ({ value: code, label: LOCALE_LABELS[code] })),
])

function selectLanguage(value: AppLocale | null): void {
  ui.setLocale(value)
}

const autoFetchIntervalKeys: Record<number, string> = {
  0: 'settings.intervals.disabled',
  60: 'settings.intervals.everyMinute',
  300: 'settings.intervals.every5Minutes',
  600: 'settings.intervals.every10Minutes',
  1800: 'settings.intervals.every30Minutes',
  3600: 'settings.intervals.everyHour',
  7200: 'settings.intervals.every2Hours',
}

/** Catalog-backed interval labels; unknown values stay numeric. */
function autoFetchIntervalLabel(sec: number): string {
  const key = autoFetchIntervalKeys[sec]
  return key ? t(key) : `${sec}s`
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (isSearching.value) {
      searchQuery.value = ''
      return
    }
    if (searchExpanded.value) {
      collapseSearch()
      return
    }
    ui.closeSettings()
    return
  }
  if (
    event.key === '/' &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !isEditableTarget(event.target)
  ) {
    event.preventDefault()
    openSearch()
  }
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
  const range = Number.isFinite(max) ? `${min}–${max} px` : `${min}+ px`
  if (key === 'refs' || key === 'graph' || key === 'commit') return range
  return ui.isColumnVisible(key) ? range : t('settings.columnWidths.hidden', { range })
}

function columnWidthMax(key: CommitColumnWidthKey): number | undefined {
  const { max } = COLUMN_WIDTH_LIMITS[key]
  return Number.isFinite(max) ? max : undefined
}

function onAutoFetchIntervalSec(value: number): void {
  ui.setAutoFetchIntervalSec(value)
  // Apply immediately: restart the background timer with the new delay.
  if (repo.hasOpenRepo) repo.restartAutoFetch()
}

watch(settingsOpen, (open) => {
  if (open) {
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('keydown', onKeydown)
    searchQuery.value = ''
    searchExpanded.value = false
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  clearTimeout(highlightTimer)
})

const avatarCacheCleared = ref(false)
let avatarCacheClearedTimer: ReturnType<typeof setTimeout> | undefined

function clearAvatarLookups(): void {
  clearAvatarCache()
  resetGithubAuthorSync()
  void syncGithubAuthors(repo.repository?.remoteUrl)
  avatarCacheCleared.value = true
  clearTimeout(avatarCacheClearedTimer)
  avatarCacheClearedTimer = setTimeout(() => {
    avatarCacheCleared.value = false
  }, 2000)
}

onUnmounted(() => clearTimeout(avatarCacheClearedTimer))
</script>

<template>
  <Teleport to="body">
    <div v-if="settingsOpen" class="fixed inset-0 z-[190] flex bg-[var(--color-app)]">
      <div
        class="flex h-full w-full flex-col overflow-hidden bg-[var(--color-app)]"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('settings.dialog.title')"
      >
        <!-- Search -->
        <div
          class="app-drag flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-panel-raised)] py-2.5 pr-4"
          data-tauri-drag-region
          @keydown="onSearchKeydown"
        >
          <!-- Reserve the macOS traffic-light area, same as the repo tab strip. -->
          <div data-tauri-drag-region class="w-20 shrink-0 self-stretch" aria-hidden="true" />
          <h1 class="shrink-0 text-[13px] font-semibold text-[var(--color-fg)]">
            {{ $t('settings.dialog.title') }}
          </h1>
          <div class="app-no-drag flex flex-1 items-center justify-end gap-2">
            <SearchInput
              v-if="searchExpanded"
              ref="searchInput"
              v-model="searchQuery"
              class="max-w-sm flex-1"
              :placeholder="$t('settings.search.placeholder')"
              shortcut="/"
            />
            <button
              v-else
              type="button"
              class="focus-ring flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
              :aria-label="$t('settings.search.open')"
              :title="$t('settings.search.openTooltip')"
              @click="openSearch"
            >
              <Search :size="16" />
            </button>
            <button
              class="focus-ring rounded p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
              :aria-label="$t('settings.dialog.close')"
              @click="ui.closeSettings()"
            >
              <X :size="16" />
            </button>
          </div>
        </div>

        <div class="flex min-h-0 flex-1">
          <!-- Sidebar nav -->
          <nav
            class="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-panel-raised)] py-4"
          >
            <div
              v-for="group in preferenceGroups"
              :key="group.label"
              class="mt-5 first:mt-0"
            >
              <p
                class="mb-1 px-4 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
              >
                {{ $t(group.label) }}
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
                @click="selectCategory(category.id)"
              >
                <component :is="category.icon" :size="15" class="shrink-0" />
                {{ $t(SETTINGS_CATEGORY_KEYS[category.id]) }}
              </button>
            </div>
          </nav>

          <!-- Content -->
          <div class="flex min-w-0 flex-1 flex-col">
            <header class="shrink-0 border-b border-[var(--color-border)] py-3.5">
              <div class="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-6">
                <h2 class="text-sm font-semibold text-[var(--color-fg)]">{{ headerTitle }}</h2>
                <span
                  v-if="isSearching"
                  class="shrink-0 text-[12px] text-[var(--color-fg-subtle)]"
                  aria-live="polite"
                >
                  {{
                    $t(
                      searchResultCount === 1
                        ? 'settings.search.resultOne'
                        : 'settings.search.resultMany',
                      { count: searchResultCount },
                    )
                  }}
                </span>
              </div>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto px-3 py-5">
              <div class="mx-auto w-full max-w-4xl">
                <!-- Search results -->
                <div v-if="isSearching">
                  <section v-for="group in searchGroups" :key="group.category" class="mb-4 last:mb-0">
                    <h3
                      class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                    >
                      {{ group.label }}
                    </h3>
                    <button
                      v-for="entry in group.entries"
                      :key="entry.id"
                      class="focus-ring flex w-full items-start justify-between gap-4 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--color-hover)]"
                      @click="goToSetting(entry)"
                    >
                      <span class="min-w-0">
                        <span class="block text-[13px] font-medium text-[var(--color-fg)]">
                          {{ entry.label }}
                        </span>
                        <span
                          v-if="entry.description"
                          class="mt-0.5 block text-[12px] leading-snug text-[var(--color-fg-muted)]"
                        >
                          {{ entry.description }}
                        </span>
                      </span>
                      <ChevronRight :size="14" class="mt-1 shrink-0 text-[var(--color-fg-subtle)]" />
                    </button>
                  </section>
                  <p
                    v-if="!searchResultCount"
                    class="px-3 py-8 text-center text-[12px] text-[var(--color-fg-muted)]"
                  >
                    {{ $t('settings.search.empty', { query: searchQuery.trim() }) }}
                  </p>
                </div>

                <template v-else>
                  <!-- Appearance -->
                  <template v-if="activeCategory === 'appearance'">
                    <section id="settings-interface-mode" class="mb-6 px-3">
                      <h3
                        class="pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                      >
                        {{ $t('settings.appearance.interface') }}
                      </h3>
                      <p class="mb-3 text-[12px] text-[var(--color-fg-muted)]">
                        {{ $t('settings.appearance.interfaceDescription') }}
                      </p>
                      <UiModePicker :model-value="uiMode" />
                    </section>
                    <p class="mb-3 px-3 text-[12px] text-[var(--color-fg-muted)]">
                      {{ $t('settings.appearance.themeDescription') }}
                    </p>
                    <section id="settings-theme" class="px-3">
                      <ThemePicker :model-value="theme" />
                    </section>
                    <section class="mt-4 px-3">
                      <SettingsSegmentedRow
                        anchor="settings-font-size"
                        :label="$t('settings.fontSize.title')"
                        :description="$t('settings.fontSize.description')"
                        :model-value="String(fontScale)"
                        :options="fontScaleOptions"
                        @update:model-value="ui.setFontScale(Number($event))"
                      />
                    </section>
                    <section id="settings-language" class="mt-6 px-3">
                      <h3
                        class="pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                      >
                        {{ $t('settings.language.title') }}
                      </h3>
                      <p class="mb-3 text-[12px] text-[var(--color-fg-muted)]">
                        {{ $t('settings.language.description') }}
                      </p>
                      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                          v-for="option in languageOptions"
                          :key="option.value ?? 'system'"
                          type="button"
                          class="focus-ring flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors"
                          :class="
                            ui.locale === option.value
                              ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                              : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)]'
                          "
                          :aria-pressed="ui.locale === option.value"
                          @click="selectLanguage(option.value)"
                        >
                          <div class="flex min-w-0 flex-1 flex-col gap-1">
                            <div class="flex items-center gap-2">
                              <span class="text-[13px] font-medium text-[var(--color-fg)]">
                                {{ option.label }}
                              </span>
                              <Check
                                v-if="ui.locale === option.value"
                                :size="14"
                                class="shrink-0 text-[var(--color-accent)]"
                              />
                            </div>
                            <p
                              v-if="option.description"
                              class="text-[12px] leading-snug text-[var(--color-fg-muted)]"
                            >
                              {{ option.description }}
                            </p>
                          </div>
                        </button>
                      </div>
                    </section>
                    <section class="mt-6 px-3">
                      <h3
                        class="pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                      >
                        {{ $t('settings.avatars.title') }}
                      </h3>
                      <SettingsRow
                        anchor="settings-remote-avatars"
                        :label="$t('settings.avatars.authorAvatars')"
                        :description="$t('settings.avatars.authorAvatarsDescription')"
                        :model-value="remoteAvatars"
                        @update:model-value="ui.setRemoteAvatars($event)"
                      />
                      <div
                        id="settings-avatar-cache"
                        class="flex items-start justify-between gap-4 rounded-lg px-3 py-2.5"
                      >
                        <div class="min-w-0 pt-0.5">
                          <div class="text-[13px] font-medium text-[var(--color-fg)]">
                            {{ $t('settings.avatars.clearCache') }}
                          </div>
                          <p class="mt-0.5 text-[12px] leading-snug text-[var(--color-fg-muted)]">
                            {{ $t('settings.avatars.clearCacheDescription') }}
                          </p>
                        </div>
                        <Button variant="secondary" size="sm" @click="clearAvatarLookups">
                          {{
                            avatarCacheCleared
                              ? $t('settings.avatars.cleared')
                              : $t('settings.avatars.clear')
                          }}
                        </Button>
                      </div>
                    </section>
                  </template>

                  <!-- Layout -->
                  <template v-else-if="activeCategory === 'layout'">
                    <p class="mb-3 px-3 text-[12px] text-[var(--color-fg-muted)]">
                      {{ $t('settings.layout.description') }}
                    </p>
                    <section class="space-y-0.5">
                      <h3
                        class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                      >
                        {{ $t('settings.layout.panels') }}
                      </h3>
                      <SettingsRow
                        anchor="settings-left-sidebar"
                        :label="$t('settings.layout.showLeftSidebar')"
                        :description="$t('settings.layout.showLeftSidebarDescription')"
                        :model-value="!leftCollapsed"
                        @update:model-value="ui.setLeftVisible($event)"
                      />
                      <SettingsRow
                        anchor="settings-right-panel"
                        :label="$t('settings.layout.showRightPanel')"
                        :description="$t('settings.layout.showRightPanelDescription')"
                        :model-value="!rightCollapsed"
                        @update:model-value="ui.setRightVisible($event)"
                      />
                    </section>
                    <section class="mt-5 space-y-2 px-3">
                      <h3
                        class="pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                      >
                        {{ $t('settings.layout.reset') }}
                      </h3>
                      <p class="text-[12px] text-[var(--color-fg-muted)]">
                        {{ $t('settings.layout.resetDescription') }}
                      </p>
                      <div id="settings-reset-layout">
                        <Button variant="secondary" size="sm" @click="ui.resetLayout()">
                          {{ $t('settings.layout.resetAction') }}
                        </Button>
                      </div>
                    </section>
                  </template>

                  <template v-else-if="activeCategory === 'changes'">
                    <p class="mb-3 px-3 text-[12px] text-[var(--color-fg-muted)]">
                      {{ $t('settings.changes.description') }}
                    </p>
                    <section class="space-y-0.5">
                      <h3
                        class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                      >
                        {{ $t('settings.changes.fileList') }}
                      </h3>
                      <SettingsRow
                        anchor="settings-tree-view"
                        :label="$t('settings.changes.treeView')"
                        :description="$t('settings.changes.treeViewDescription')"
                        :model-value="fileListView === 'tree'"
                        @update:model-value="ui.setFileListView($event ? 'tree' : 'path')"
                      />
                    </section>
                  </template>

                  <template v-else-if="activeCategory === 'commits'">
                    <p class="mb-3 px-3 text-[12px] text-[var(--color-fg-muted)]">
                      {{ $t('settings.commits.description') }}
                    </p>
                    <section class="space-y-0.5">
                      <h3
                        class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                      >
                        {{ $t('settings.commits.options') }}
                      </h3>
                      <SettingsRow
                        anchor="settings-sign-off"
                        :label="$t('settings.commits.signOff')"
                        :description="$t('settings.commits.signOffDescription')"
                        :model-value="signOffCommit"
                        @update:model-value="ui.setSignOffCommit($event)"
                      />
                      <SettingsRow
                        anchor="settings-sign-commit"
                        :label="$t('settings.commits.sign')"
                        :description="$t('settings.commits.signDescription')"
                        :model-value="signCommit"
                        @update:model-value="ui.setSignCommit($event)"
                      />
                    </section>
                  </template>

                  <!-- Commit Graph -->
                  <template v-else-if="activeCategory === 'commit-graph'">
                    <p class="mb-3 px-3 text-[12px] text-[var(--color-fg-muted)]">
                      {{ $t('settings.commitGraph.description') }}
                    </p>
                    <section class="space-y-0.5">
                      <h3
                        class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                      >
                        {{ $t('settings.commitGraph.history') }}
                      </h3>
                      <SettingsRow
                        anchor="settings-graph-scope"
                        :label="$t('settings.commitGraph.showAllBranches')"
                        :description="$t('settings.commitGraph.showAllBranchesDescription')"
                        :model-value="graphScopeAll"
                        @update:model-value="onGraphScopeAll($event)"
                      />
                      <div
                        id="settings-graph-limit"
                        class="flex items-start justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--color-hover)]"
                      >
                        <div class="min-w-0 pt-0.5">
                          <div class="text-[13px] font-medium text-[var(--color-fg)]">
                            {{ $t('settings.commitGraph.recentCommits') }}
                          </div>
                          <p class="mt-0.5 text-[12px] leading-snug text-[var(--color-fg-muted)]">
                            {{
                              $t('settings.commitGraph.recentCommitsDescription', {
                                min: COMMIT_GRAPH_LIMIT_MIN,
                                recommended: COMMIT_GRAPH_LIMIT_RECOMMENDED,
                              })
                            }}
                          </p>
                        </div>
                        <input
                          type="number"
                          class="focus-ring w-20 rounded-md border border-[var(--color-border)] bg-[var(--color-app)] px-2 py-1 text-right text-[13px] text-[var(--color-fg)]"
                          :min="COMMIT_GRAPH_LIMIT_MIN"
                          :value="commitGraphLimit"
                          :aria-label="$t('settings.commitGraph.recentCommits')"
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
                        {{ $t('settings.commitGraph.columns') }}
                      </h3>
                      <p class="px-3 pb-1 text-[12px] text-[var(--color-fg-muted)]">
                        {{ $t('settings.commitGraph.columnsDescription') }}
                      </p>
                      <SettingsRow
                        v-for="key in columnKeys"
                        :key="key"
                        :anchor="`settings-column-${key}`"
                        :label="$t(COLUMN_LABEL_KEYS[key])"
                        :description="$t(columnDescriptions[key])"
                        :model-value="ui.isColumnVisible(key)"
                        @update:model-value="ui.setColumnVisible(key, $event)"
                      />
                    </section>
                    <section class="mt-5 space-y-0.5">
                      <h3
                        class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                      >
                        {{ $t('settings.commitGraph.indicators') }}
                      </h3>
                      <SettingsRow
                        anchor="settings-time-markers"
                        :label="$t('settings.commitGraph.timeIndicators')"
                        :description="$t('settings.commitGraph.timeIndicatorsDescription')"
                        :model-value="ui.showTimeMarkers"
                        @update:model-value="ui.setShowTimeMarkers($event)"
                      />
                      <SettingsRow
                        anchor="settings-merge-indicators"
                        :label="$t('settings.commitGraph.mergeIndicators')"
                        :description="$t('settings.commitGraph.mergeIndicatorsDescription')"
                        :model-value="ui.showMergeIndicators"
                        @update:model-value="ui.setShowMergeIndicators($event)"
                      />
                    </section>
                    <section class="mt-5 space-y-0.5">
                      <div
                        id="settings-column-widths"
                        class="flex items-center justify-between gap-3 px-3 pb-1"
                      >
                        <h3
                          class="text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                        >
                          {{ $t('settings.commitGraph.columnWidths') }}
                        </h3>
                        <Button variant="secondary" size="sm" @click="ui.resetColumnWidths()">
                          {{ $t('settings.commitGraph.resetWidths') }}
                        </Button>
                      </div>
                      <p class="px-3 pb-1 text-[12px] text-[var(--color-fg-muted)]">
                        {{ $t('settings.commitGraph.columnWidthsDescription') }}
                      </p>
                      <div
                        v-for="key in columnWidthKeys"
                        :key="key"
                        class="flex items-center justify-between gap-4 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--color-hover)]"
                      >
                        <div class="min-w-0">
                          <div class="text-[13px] font-medium text-[var(--color-fg)]">
                            {{ $t(COLUMN_WIDTH_LABEL_KEYS[key]) }}
                          </div>
                          <p class="mt-0.5 text-[12px] leading-snug text-[var(--color-fg-muted)]">
                            {{ columnWidthHint(key) }}
                          </p>
                        </div>
                        <input
                          type="number"
                          class="focus-ring w-20 shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-app)] px-2 py-1 text-right text-[13px] text-[var(--color-fg)]"
                          :min="COLUMN_WIDTH_LIMITS[key].min"
                          :max="columnWidthMax(key)"
                          :value="ui.columnWidths[key]"
                          :aria-label="
                            $t('settings.columnWidths.ariaLabel', {
                              name: $t(COLUMN_WIDTH_LABEL_KEYS[key]),
                            })
                          "
                          @change="
                            onColumnWidth(key, Number(($event.target as HTMLInputElement).value))
                          "
                        />
                      </div>
                    </section>
                  </template>

                  <template v-else-if="activeCategory === 'sidebar'">
                    <p class="mb-3 px-3 text-[12px] text-[var(--color-fg-muted)]">
                      {{ $t('settings.sidebar.description') }}
                    </p>
                    <section class="space-y-0.5">
                      <h3
                        class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                      >
                        {{ $t('settings.sidebar.sections') }}
                      </h3>
                      <SettingsSegmentedRow
                        v-for="key in sidebarSectionKeys"
                        :key="key"
                        :anchor="`settings-sidebar-${key}`"
                        :label="$t(SECTION_LABEL_KEYS[key])"
                        :description="sectionDescription(key)"
                        :model-value="ui.sectionState(key)"
                        :options="sectionStateOptions"
                        @update:model-value="onSectionState(key, $event)"
                      />
                    </section>
                  </template>

                  <template v-else-if="activeCategory === 'sync'">
                    <p class="mb-3 px-3 text-[12px] text-[var(--color-fg-muted)]">
                      {{ $t('settings.sync.description') }}
                    </p>
                    <section class="space-y-0.5">
                      <h3
                        class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                      >
                        {{ $t('settings.sync.backgroundFetch') }}
                      </h3>
                      <div
                        id="settings-auto-fetch"
                        class="flex items-start justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--color-hover)]"
                      >
                        <div class="min-w-0 pt-0.5">
                          <div class="text-[13px] font-medium text-[var(--color-fg)]">
                            {{ $t('settings.sync.autoFetchInterval') }}
                          </div>
                          <p class="mt-0.5 text-[12px] leading-snug text-[var(--color-fg-muted)]">
                            {{ $t('settings.sync.autoFetchIntervalDescription') }}
                          </p>
                        </div>
                        <select
                          class="focus-ring shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-app)] px-2 py-1 text-[13px] text-[var(--color-fg)]"
                          :value="autoFetchIntervalSec"
                          :aria-label="$t('settings.sync.autoFetchInterval')"
                          @change="
                            onAutoFetchIntervalSec(Number(($event.target as HTMLSelectElement).value))
                          "
                        >
                          <option
                            v-for="option in AUTO_FETCH_INTERVAL_OPTIONS"
                            :key="option"
                            :value="option"
                          >
                            {{ autoFetchIntervalLabel(option) }}
                          </option>
                        </select>
                      </div>
                    </section>
                  </template>

                  <template v-else-if="activeCategory === 'shortcuts'">
                    <div class="mb-3 flex items-start justify-between gap-3 px-3">
                      <p class="text-[12px] text-[var(--color-fg-muted)]">
                        {{ $t('settings.shortcuts.description') }}
                      </p>
                      <Button variant="secondary" size="sm" class="shrink-0" @click="ui.resetAllKeybindings()">
                        {{ $t('settings.shortcuts.restoreDefaults') }}
                      </Button>
                    </div>
                    <section v-for="[group, ids] in visibleShortcutGroups" :key="group" class="mb-4 space-y-0.5">
                      <h3
                        class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
                      >
                        {{ $t(commandCategoryKey(group)) }}
                      </h3>
                      <div
                        v-for="id in ids"
                        :id="`settings-shortcut-${id}`"
                        :key="id"
                        class="flex items-center justify-between gap-4 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--color-hover)]"
                      >
                        <div class="min-w-0">
                          <div class="text-[13px] text-[var(--color-fg)]">
                            {{ $t(COMMAND_META[id].titleKey) }}
                          </div>
                          <div v-if="isConflicted(id)" class="mt-0.5 text-[11px] text-[var(--color-danger)]">
                            {{ conflictNames(id) }}
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
                            :aria-label="
                              $t('settings.shortcuts.disable', { name: $t(COMMAND_META[id].titleKey) })
                            "
                            :title="$t('settings.shortcuts.disableTooltip')"
                            @click="ui.clearBinding(id)"
                          >
                            ×
                          </button>
                          <button
                            class="focus-ring rounded px-1.5 py-0.5 text-[11px] text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
                            :aria-label="
                              $t('settings.shortcuts.reset', { name: $t(COMMAND_META[id].titleKey) })
                            "
                            :title="$t('settings.shortcuts.resetTooltip')"
                            @click="ui.resetBinding(id)"
                          >
                            ↺
                          </button>
                        </div>
                      </div>
                    </section>
                  </template>

                  <template v-else-if="activeCategory === 'credits'">
                    <SettingsCreditsPanel id="settings-credits" />
                  </template>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-anchor-highlight {
  animation: settings-anchor-highlight 1.6s ease-out;
}

@keyframes settings-anchor-highlight {
  0%,
  35% {
    background-color: var(--color-accent-soft);
  }
  100% {
    background-color: transparent;
  }
}
</style>
