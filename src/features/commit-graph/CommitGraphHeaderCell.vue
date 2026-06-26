<script setup lang="ts">
import ColumnResizeHandle from '@/components/ui/ColumnResizeHandle.vue'

defineProps<{
  label: string
  width?: number
  align?: 'left' | 'right'
  resizable?: boolean
}>()

const emit = defineEmits<{ resize: [deltaX: number] }>()
</script>

<template>
  <div
    class="relative flex shrink-0 items-center truncate px-2"
    :class="[align === 'right' ? 'justify-end text-right' : '']"
    :style="width != null ? { width: `${width}px` } : undefined"
  >
    <span class="truncate">{{ label }}</span>
    <ColumnResizeHandle v-if="resizable" @resize="emit('resize', $event)" />
  </div>
</template>
