<script setup lang="ts">
import ColumnResizeHandle from '@/components/ui/ColumnResizeHandle.vue'

defineProps<{
  label: string
  width?: number
  align?: 'left' | 'right'
  resizable?: boolean
  /** Stretch to fill the remaining row width (used by the last column). */
  grow?: boolean
}>()

const emit = defineEmits<{ resize: [deltaX: number] }>()
</script>

<template>
  <div
    class="relative flex items-center truncate px-2"
    :class="[
      grow ? 'min-w-0 flex-auto' : 'shrink-0',
      align === 'right' ? 'justify-end text-right' : '',
      grow && align === 'right' ? 'pr-10' : '',
    ]"
    :style="width != null ? { width: `${width}px` } : undefined"
  >
    <span class="truncate">{{ label }}</span>
    <ColumnResizeHandle v-if="resizable" @resize="emit('resize', $event)" />
  </div>
</template>
