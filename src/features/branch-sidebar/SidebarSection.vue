<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight } from '@lucide/vue'
import { useUiStore } from '@/stores/ui'

const props = defineProps<{
  sectionKey: string
  title: string
  count?: number
}>()

const ui = useUiStore()
const open = computed(() => ui.isSectionOpen(props.sectionKey))
</script>

<template>
  <section class="select-none">
    <button
      class="focus-ring group flex h-7 w-full items-center gap-1 px-2 text-[11px] font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase hover:text-[var(--color-fg)]"
      @click="ui.toggleSection(sectionKey)"
    >
      <ChevronRight
        :size="13"
        class="shrink-0 transition-transform duration-150"
        :class="open ? 'rotate-90' : ''"
      />
      <span class="flex-1 text-left">{{ title }}</span>
      <span v-if="count != null" class="font-mono text-[10px] text-[var(--color-fg-subtle)]">
        {{ count }}
      </span>
    </button>
    <Transition name="section">
      <div v-show="open" class="overflow-hidden pb-1">
        <slot />
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.section-enter-active,
.section-leave-active {
  transition: opacity 0.15s ease;
}
.section-enter-from,
.section-leave-to {
  opacity: 0;
}
</style>
