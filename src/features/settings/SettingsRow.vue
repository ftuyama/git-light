<script setup lang="ts">
import Checkbox from '@/components/ui/Checkbox.vue'

defineProps<{
  label: string
  description?: string
  modelValue: boolean
}>()

defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<template>
  <label
    class="flex cursor-pointer items-start justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--color-hover)]"
  >
    <div class="min-w-0 pt-0.5">
      <div class="text-[13px] font-medium text-[var(--color-fg)]">{{ label }}</div>
      <p v-if="description" class="mt-0.5 text-[12px] leading-snug text-[var(--color-fg-muted)]">
        {{ description }}
      </p>
    </div>
    <Checkbox
      :model-value="modelValue"
      :aria-label="label"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </label>
</template>
