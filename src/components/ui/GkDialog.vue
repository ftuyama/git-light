<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import GkButton from './GkButton.vue'

const props = defineProps<{
  open: boolean
  title: string
  danger?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const inputRef = ref<HTMLInputElement>()

watch(
  () => props.open,
  (open) => {
    if (open) setTimeout(() => inputRef.value?.focus(), 0)
  },
)

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('cancel')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      @click.self="emit('cancel')"
    >
      <div
        class="w-full max-w-md rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-panel)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <header class="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 class="text-sm font-semibold text-[var(--color-fg)]">{{ title }}</h2>
          <button
            class="focus-ring rounded p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
            aria-label="Close"
            @click="emit('cancel')"
          >
            <X :size="16" />
          </button>
        </header>

        <div class="space-y-3 px-4 py-4">
          <slot />
        </div>

        <footer class="flex justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
          <slot name="footer">
            <GkButton variant="ghost" @click="emit('cancel')">Cancel</GkButton>
            <GkButton :variant="danger ? 'danger' : 'primary'" @click="emit('confirm')">OK</GkButton>
          </slot>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
