<script setup lang="ts">
import { Settings } from '@lucide/vue'
import GkIconButton from '@/components/ui/GkIconButton.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <GkIconButton :icon="Settings" label="Settings" @click="ui.openSettings()" />
</template>
