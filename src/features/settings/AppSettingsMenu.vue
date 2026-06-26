<script setup lang="ts">
import { Settings } from '@lucide/vue'
import IconButton from '@/components/ui/IconButton.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <IconButton :icon="Settings" label="Settings" @click="ui.openSettings()" />
</template>
