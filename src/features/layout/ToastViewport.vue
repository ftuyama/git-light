<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import { CheckCircle2, Info, XCircle } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()
const { toasts } = storeToRefs(toastStore)

const icons = { success: CheckCircle2, error: XCircle, info: Info }
const colors = {
  success: 'var(--color-success)',
  error: 'var(--color-danger)',
  info: 'var(--color-info)',
}
</script>

<template>
  <div class="pointer-events-none fixed right-4 bottom-9 z-[100] flex flex-col items-end gap-2">
    <AnimatePresence>
      <motion.div
        v-for="toast in toasts"
        :key="toast.id"
        :initial="{ opacity: 0, x: 24, scale: 0.96 }"
        :animate="{ opacity: 1, x: 0, scale: 1 }"
        :exit="{ opacity: 0, x: 24, scale: 0.96 }"
        :transition="{ duration: 0.2, ease: 'easeOut' }"
        class="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-elevated)] py-2 pr-3 pl-2.5 shadow-xl shadow-black/50"
      >
        <component :is="icons[toast.tone]" :size="16" :style="{ color: colors[toast.tone] }" />
        <span class="text-[13px] text-[var(--color-fg)]">{{ toast.message }}</span>
      </motion.div>
    </AnimatePresence>
  </div>
</template>
