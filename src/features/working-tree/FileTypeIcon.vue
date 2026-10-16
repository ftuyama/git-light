<script setup lang="ts">
import { computed } from 'vue'
import { File as FileFallback } from '@lucide/vue'
import { getClassWithColor } from 'file-icons-js'

const props = defineProps<{ path: string; className?: string }>()

const FALLBACK_CLASS = 'text-icon'
const iconClass = computed(() => getClassWithColor(props.path) ?? FALLBACK_CLASS)
</script>

<template>
  <span
    v-if="iconClass === FALLBACK_CLASS"
    class="inline-flex h-4 w-4 shrink-0 items-center justify-center"
  >
    <FileFallback :size="14" class="text-[var(--color-fg-subtle)]" aria-hidden="true" />
  </span>
  <span
    v-else
    :class="`file-icon icon ${iconClass} inline-flex h-4 w-4 shrink-0 items-center justify-center ${props.className ?? ''}`"
    aria-hidden="true"
  />
</template>

<style scoped>
.file-icon.icon::before {
  position: static !important;
  font-size: 14px !important;
  width: auto !important;
  display: inline !important;
  line-height: 1 !important;
}
</style>
