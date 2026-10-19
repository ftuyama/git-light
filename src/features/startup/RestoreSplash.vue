<script setup lang="ts">
import { Loader2 } from '@lucide/vue'
import iconUrl from '@/assets/icon.png'

/**
 * Shown for the first moments of launch, before `bootstrap` knows whether the
 * previous session can be restored. It deliberately carries none of the startup
 * picker (repository list, clone/init, UI mode) so a returning user lands on
 * their last repository without the initial screen flashing by.
 */
</script>

<template>
  <div
    class="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[var(--color-app)]"
  >
    <div data-tauri-drag-region class="app-drag absolute inset-x-0 top-0 h-12" aria-hidden="true" />
    <img :src="iconUrl" alt="" width="64" height="64" class="h-16 w-16" />
    <div class="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
      <Loader2 :size="14" class="animate-spin" />
      <span>Opening Git Light…</span>
    </div>
  </div>
</template>
