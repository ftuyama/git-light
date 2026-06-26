<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Terminal as TerminalIcon, X } from '@lucide/vue'
import IconButton from '@/components/ui/IconButton.vue'
import { useTerminal } from '@/composables/useTerminal'
import { useRepositoryStore } from '@/stores/repository'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const repo = useRepositoryStore()
const container = ref<HTMLElement | null>(null)
const cwd = computed(() => repo.repository?.path ?? null)
const { ready, unavailable, fit, focus } = useTerminal(container, cwd)

watch(
  () => ui.terminalOpen,
  (open) => {
    if (!open) return
    requestAnimationFrame(() => {
      void fit()
      focus()
    })
  },
)
</script>

<template>
  <section class="flex h-full min-h-0 flex-col border-t border-[var(--color-border)] bg-[var(--color-app)]">
    <header
      class="flex h-8 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-2"
    >
      <TerminalIcon :size="14" class="shrink-0 text-[var(--color-fg-subtle)]" />
      <span class="text-[11px] font-semibold tracking-wide text-[var(--color-fg-muted)] uppercase">
        Terminal
      </span>
      <span
        v-if="cwd"
        class="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--color-fg-subtle)]"
        :title="cwd"
      >
        {{ cwd }}
      </span>
      <span v-else class="flex-1 text-[11px] text-[var(--color-fg-subtle)]">No repository open</span>
      <span
        v-if="unavailable"
        class="text-[11px] text-[var(--color-danger)]"
      >
        Unavailable
      </span>
      <span
        v-else-if="ready"
        class="text-[11px] text-[var(--color-fg-subtle)]"
      >
        zsh
      </span>
      <IconButton :icon="X" label="Close terminal" tooltip-side="left" @click="ui.closeTerminal()" />
    </header>
    <div ref="container" class="terminal-host min-h-0 flex-1 px-1 py-1" />
  </section>
</template>

<style scoped>
.terminal-host :deep(.xterm) {
  height: 100%;
}

.terminal-host :deep(.xterm-viewport) {
  overflow-y: auto;
}
</style>
