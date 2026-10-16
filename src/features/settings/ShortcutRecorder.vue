<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { eventToBinding, formatBindings, type KeyBinding } from '@/lib/keybindings'

const props = defineProps<{
  bindings: KeyBinding[]
}>()

const emit = defineEmits<{
  capture: [binding: KeyBinding]
  cancel: []
}>()

const recording = ref(false)

function start(): void {
  recording.value = true
  window.addEventListener('keydown', onKeydown, true)
}

function stop(): void {
  recording.value = false
  window.removeEventListener('keydown', onKeydown, true)
}

function onKeydown(event: KeyboardEvent): void {
  event.preventDefault()
  event.stopPropagation()
  // Esc alone cancels without assigning.
  if (event.key === 'Escape' && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    stop()
    emit('cancel')
    return
  }
  // Ignore lone modifier presses.
  if (['Meta', 'Control', 'Shift', 'Alt'].includes(event.key)) return
  const binding = eventToBinding(event)
  stop()
  emit('capture', binding)
}

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <button
    type="button"
    class="focus-ring shrink-0 rounded border px-2 py-0.5 font-mono text-[11px] transition-colors"
    :class="
      recording
        ? 'animate-pulse border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
        : 'border-[var(--color-border)] bg-[var(--color-app)] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]'
    "
    :aria-label="recording ? 'Press keys for shortcut, Esc to cancel' : 'Click to record new shortcut'"
    @click="start"
  >
    {{ recording ? 'Press keys…' : formatBindings(props.bindings) }}
  </button>
</template>
