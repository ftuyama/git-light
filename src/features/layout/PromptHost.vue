<script setup lang="ts">
import { storeToRefs } from 'pinia'
import GkDialog from '@/components/ui/GkDialog.vue'
import GkButton from '@/components/ui/GkButton.vue'
import { usePromptStore } from '@/stores/prompt'

const prompt = usePromptStore()
const { open, mode, title, message, placeholder, value, confirmLabel, cancelLabel, danger } =
  storeToRefs(prompt)
</script>

<template>
  <GkDialog
    :open="open"
    :title="title"
    :danger="danger"
    @confirm="prompt.submit()"
    @cancel="prompt.cancel()"
  >
    <p v-if="message" class="text-sm text-[var(--color-fg-muted)]">{{ message }}</p>
    <input
      v-if="mode === 'prompt'"
      v-model="value"
      type="text"
      class="focus-ring w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-panel-raised)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none"
      :placeholder="placeholder"
      @keydown.enter="prompt.submit()"
    />

    <template #footer>
      <GkButton variant="ghost" @click="prompt.cancel()">{{ cancelLabel }}</GkButton>
      <GkButton :variant="danger ? 'danger' : 'primary'" @click="prompt.submit()">
        {{ confirmLabel }}
      </GkButton>
    </template>
  </GkDialog>
</template>
