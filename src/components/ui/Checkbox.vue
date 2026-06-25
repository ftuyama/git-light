<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'
import { Check, Minus } from '@lucide/vue'

defineProps<{
  modelValue: boolean | 'indeterminate'
  ariaLabel?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<template>
  <CheckboxRoot
    :model-value="modelValue"
    :aria-label="ariaLabel"
    class="focus-ring flex size-4 shrink-0 items-center justify-center rounded border border-[var(--color-border-strong)] bg-[var(--color-panel)] transition-colors data-[state=checked]:border-[var(--color-accent-strong)] data-[state=checked]:bg-[var(--color-accent-strong)] data-[state=indeterminate]:border-[var(--color-accent-strong)] data-[state=indeterminate]:bg-[var(--color-accent-strong)]"
    @update:model-value="(value) => emit('update:modelValue', value === true)"
    @click.stop
  >
    <CheckboxIndicator class="text-white">
      <Minus v-if="modelValue === 'indeterminate'" :size="12" :stroke-width="3" />
      <Check v-else :size="12" :stroke-width="3" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
