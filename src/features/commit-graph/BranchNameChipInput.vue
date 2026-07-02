<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { Monitor } from '@lucide/vue'

const FOCUS_GRACE_MS = 600

const props = defineProps<{
  color: string
}>()

const emit = defineEmits<{
  submit: [name: string]
  cancel: []
}>()

const value = ref('')
const inputRef = useTemplateRef('inputRef')
let ignoreBlurUntil = 0
let focusSession = 0

const chipStyle = computed(() => ({
  color: `color-mix(in srgb, ${props.color} 50%, var(--color-fg))`,
  backgroundColor: `color-mix(in srgb, ${props.color} 38%, var(--color-panel-raised))`,
  border: `1px solid color-mix(in srgb, ${props.color} 72%, var(--color-border-strong))`,
}))

function bumpFocusGrace(): void {
  ignoreBlurUntil = Date.now() + FOCUS_GRACE_MS
}

function focusInput(): boolean {
  const el = inputRef.value
  if (!el) return false
  el.focus({ preventScroll: true })
  return document.activeElement === el
}

async function focusWhenReady(): Promise<void> {
  const session = ++focusSession
  bumpFocusGrace()

  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      if (ms === 0) requestAnimationFrame(() => resolve())
      else setTimeout(resolve, ms)
    })

  await nextTick()
  if (session !== focusSession) return

  for (const delay of [0, 0, 0, 16, 50, 100, 150, 250]) {
    if (session !== focusSession) return
    await wait(delay)
    bumpFocusGrace()
    if (focusInput()) return
  }
}

onMounted(() => {
  void focusWhenReady()
})

defineExpose({ focus: focusInput, focusWhenReady })

function submit(): void {
  const name = value.value.trim()
  if (name) emit('submit', name)
  else emit('cancel')
}

function onKeydown(event: KeyboardEvent): void {
  event.stopPropagation()
  if (event.key === 'Enter') {
    event.preventDefault()
    submit()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel')
  }
}

function onBlur(): void {
  if (Date.now() < ignoreBlurUntil) {
    requestAnimationFrame(() => {
      focusInput()
    })
    return
  }
  requestAnimationFrame(() => {
    if (document.activeElement === inputRef.value) return
    emit('cancel')
  })
}
</script>

<template>
  <span
    class="inline-flex h-[18px] w-full max-w-full min-w-0 items-center gap-0.5 overflow-hidden rounded px-1.5 text-[11px] font-medium"
    :style="chipStyle"
  >
    <input
      ref="inputRef"
      v-model="value"
      type="text"
      class="min-w-0 flex-1 bg-transparent text-[11px] font-medium outline-none placeholder:font-normal placeholder:text-[var(--color-fg-subtle)]"
      placeholder="Enter branch name"
      spellcheck="false"
      @keydown="onKeydown"
      @blur="onBlur"
    />
    <Monitor :size="10" class="shrink-0 opacity-90" />
  </span>
</template>
