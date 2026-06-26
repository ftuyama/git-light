<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 16 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      d="M20.216 6.415l-.132-.666A3.981 3.981 0 0 0 16.2 2.75H3.98A3.981 3.981 0 0 0 1.098 5.75l-.132.666A2.001 2.001 0 0 0 0 7.75v.5A2.001 2.001 0 0 0 1.966 10.25h.068a3.001 3.001 0 0 0 5.932 0h7.068a3.001 3.001 0 0 0 5.932 0h.068A2.001 2.001 0 0 0 24 8.25v-.5a2.001 2.001 0 0 0-1.966-1.835zM6 18.75a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5zm12 0a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5z"
    />
  </svg>
</template>
