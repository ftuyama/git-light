<script setup lang="ts">
import { type Component, computed } from 'vue'
import { Cloud, FileDiff, Inbox, Laptop, PanelLeftOpen, PanelRightOpen, Tag, TreePine } from '@lucide/vue'
import IconButton from '@/components/ui/IconButton.vue'
import {
  ADVANCED_SECTION_KEYS,
  SECTION_LABEL_KEYS,
  type SectionKey,
} from '@/lib/preferences'
import { translate } from '@/locales'
import { useUiStore } from '@/stores/ui'
import { useSidebarSectionCounts } from '@/features/branch-sidebar/useSidebarSectionCounts'

const props = defineProps<{ side: 'left' | 'right' }>()
const emit = defineEmits<{ expand: [] }>()

const ui = useUiStore()
const { sectionCount } = useSidebarSectionCounts()

/** Sections reachable from the collapsed rail, in sidebar order. */
const RAIL_SECTIONS: readonly { key: SectionKey; icon: Component }[] = [
  { key: 'localBranches', icon: Laptop },
  { key: 'remoteBranches', icon: Cloud },
  { key: 'worktrees', icon: TreePine },
  { key: 'stashes', icon: Inbox },
  { key: 'tags', icon: Tag },
]

const sections = computed(() =>
  RAIL_SECTIONS.filter(
    ({ key }) =>
      ui.isSectionVisible(key) &&
      (ui.isAdvanced ||
        !ADVANCED_SECTION_KEYS.includes(key as (typeof ADVANCED_SECTION_KEYS)[number])),
  ).map(({ key, icon }) => ({
    key,
    icon,
    label: translate(SECTION_LABEL_KEYS[key]),
    count: sectionCount(key),
  })),
)

function openSection(key: SectionKey): void {
  ui.setSectionVisible(key, true)
  ui.setSectionOpen(key, true)
  if (props.side === 'left' && ui.leftCollapsed) emit('expand')
}
</script>

<template>
  <div
    class="flex w-12 shrink-0 flex-col items-center gap-1 border-[var(--color-border)] bg-[var(--color-panel)] py-2"
    :class="side === 'left' ? 'border-r' : 'border-l'"
  >
    <IconButton
      :icon="side === 'left' ? PanelLeftOpen : PanelRightOpen"
      :label="`Expand ${side} panel`"
      :tooltip-side="side === 'left' ? 'right' : 'left'"
      @click="$emit('expand')"
    />

    <div class="my-1 h-px w-6 bg-[var(--color-border)]" />

    <template v-if="side === 'left'">
      <IconButton
        v-for="section in sections"
        :key="section.key"
        :icon="section.icon"
        :label="section.label"
        :count="section.count"
        tooltip-side="right"
        @click="openSection(section.key)"
      />
    </template>

    <IconButton
      v-else
      :icon="FileDiff"
      label="Changes"
      tooltip-side="left"
      @click="$emit('expand')"
    />
  </div>
</template>
