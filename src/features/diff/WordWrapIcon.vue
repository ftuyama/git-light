<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number
  }>(),
  { size: 12 },
)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    class="inline shrink-0"
    aria-hidden="true"
  >
    <line x1="1" y1="3" x2="7" y2="3" />
    <line x1="1" y1="6.5" x2="15" y2="6.5" />
    <line x1="1" y1="10" x2="7" y2="10" />
    <line x1="1" y1="13.5" x2="15" y2="13.5" />
  </svg>
</template>
