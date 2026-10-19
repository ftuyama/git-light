<script setup lang="ts">
import { Loader2 } from '@lucide/vue'
import { useUiStore } from '@/stores/ui'

/**
 * Stand-in for the three-pane main view while a cold tab switch loads its
 * snapshot. `pendingRepoPath` is set for the whole round-trip (100-500ms on
 * this machine, longer on big repos), and the store keeps the *outgoing*
 * repository until the new snapshot lands — so without this the panes would
 * show the repository the user just left.
 *
 * Pane widths and header heights mirror the real layout (same CSS variables,
 * same `ui` sizes) so the swap to live content does not shift anything.
 */
defineProps<{ repoName?: string }>()

const ui = useUiStore()

const GRAPH_ROWS = 18
const BRANCH_ROWS = 12
const FILE_ROWS = 10

/** Deterministic bar widths — a static skeleton still reads as "content". */
function barWidth(seed: number, min: number, span: number): string {
  return `${min + ((seed * 17) % span)}%`
}
</script>

<template>
  <div
    class="flex min-h-0 flex-1 flex-col"
    aria-busy="true"
    data-testid="repo-loading-skeleton"
  >
    <!-- Toolbar -->
    <div
      class="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-panel)] px-3"
    >
      <div class="h-7 w-28 animate-pulse rounded bg-[var(--color-hover)]" />
      <div class="h-7 w-20 animate-pulse rounded bg-[var(--color-hover)]" />
      <div class="mx-1 h-5 w-px shrink-0 bg-[var(--color-border)]" />
      <div class="h-7 w-24 animate-pulse rounded bg-[var(--color-hover)]" />
      <div class="h-7 w-24 animate-pulse rounded bg-[var(--color-hover)]" />
      <div class="flex-1" />
      <div class="h-7 w-36 animate-pulse rounded bg-[var(--color-hover)]" />
    </div>

    <!-- Operation banner slot stays empty, as it is without an operation. -->

    <div class="relative flex min-h-0 flex-1">
      <div
        role="status"
        aria-live="polite"
        class="pointer-events-none absolute top-10 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-1 text-[11px] text-[var(--color-fg-muted)] shadow-sm"
      >
        <Loader2 :size="13" class="animate-spin" />
        <span>Opening {{ repoName ?? 'repository' }}…</span>
      </div>

      <!-- Branch sidebar -->
      <div
        v-if="ui.leftCollapsed"
        class="w-12 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-panel)]"
      />
      <aside
        v-else
        class="flex shrink-0 flex-col gap-1 overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-panel)] p-3"
        :style="{ width: `${ui.leftSize}%` }"
      >
        <div class="mb-1 h-6 animate-pulse rounded bg-[var(--color-hover)]" />
        <div
          v-for="row in BRANCH_ROWS"
          :key="row"
          class="flex h-6 shrink-0 items-center gap-2"
        >
          <span class="size-2 shrink-0 rounded-full bg-[var(--color-lane-1)] opacity-70" />
          <div
            class="h-2.5 animate-pulse rounded bg-[var(--color-hover)]"
            :style="{ width: barWidth(row, 30, 50) }"
          />
        </div>
      </aside>

      <!-- Commit graph -->
      <div class="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--color-app)]">
        <div class="flex h-8 shrink-0 items-center gap-4 border-b border-[var(--color-border)] px-3">
          <div class="h-2.5 w-16 animate-pulse rounded bg-[var(--color-hover)]" />
          <div class="h-2.5 w-24 animate-pulse rounded bg-[var(--color-hover)]" />
          <div class="h-2.5 w-20 animate-pulse rounded bg-[var(--color-hover)]" />
          <div class="flex-1" />
          <div class="h-2.5 w-14 animate-pulse rounded bg-[var(--color-hover)]" />
        </div>
        <div class="flex min-h-0 flex-1 flex-col overflow-hidden py-1">
          <div v-for="row in GRAPH_ROWS" :key="row" class="flex h-7 shrink-0 items-center gap-3 px-3">
            <div class="flex w-10 shrink-0 items-center justify-center">
              <span
                class="size-2.5 shrink-0 rounded-full"
                :style="{ backgroundColor: `var(--color-lane-${row % 4})` }"
              />
            </div>
            <div
              class="h-2.5 animate-pulse rounded bg-[var(--color-hover)]"
              :style="{ width: barWidth(row, 26, 45) }"
            />
            <div class="h-2.5 w-16 shrink-0 animate-pulse rounded bg-[var(--color-hover)] opacity-70" />
            <div class="h-2.5 w-24 shrink-0 animate-pulse rounded bg-[var(--color-hover)] opacity-50" />
          </div>
        </div>
      </div>

      <!-- Working tree -->
      <div
        v-if="ui.rightCollapsed"
        class="w-12 shrink-0 border-l border-[var(--color-border)] bg-[var(--color-panel)]"
      />
      <aside
        v-else
        class="flex shrink-0 flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-panel)]"
        :style="{ width: `${ui.rightSize}%` }"
      >
        <div class="flex h-9 shrink-0 items-center gap-2 px-3">
          <div class="h-3 w-20 animate-pulse rounded bg-[var(--color-hover)]" />
        </div>
        <div class="flex flex-col gap-1 px-3">
          <div
            v-for="row in FILE_ROWS"
            :key="row"
            class="flex h-6 shrink-0 items-center gap-2"
          >
            <div class="size-3 shrink-0 animate-pulse rounded-sm bg-[var(--color-hover)]" />
            <div
              class="h-2.5 animate-pulse rounded bg-[var(--color-hover)]"
              :style="{ width: barWidth(row, 34, 45) }"
            />
            <div class="ml-auto h-2.5 w-6 shrink-0 animate-pulse rounded bg-[var(--color-hover)] opacity-60" />
          </div>
          <div class="mt-3 h-3 w-16 animate-pulse rounded bg-[var(--color-hover)]" />
          <div
            v-for="row in 3"
            :key="`staged-${row}`"
            class="flex h-6 shrink-0 items-center gap-2"
          >
            <div class="size-3 shrink-0 animate-pulse rounded-sm bg-[var(--color-hover)]" />
            <div
              class="h-2.5 animate-pulse rounded bg-[var(--color-hover)]"
              :style="{ width: barWidth(row + FILE_ROWS, 34, 45) }"
            />
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
