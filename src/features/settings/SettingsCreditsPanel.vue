<script setup lang="ts">
import { type Component } from 'vue'
import { Globe } from '@lucide/vue'
import GithubIcon from '@/components/icons/GithubIcon.vue'
import KofiIcon from '@/components/icons/KofiIcon.vue'
import { APP_LINKS, THIRD_PARTY_CREDITS, type AppLinkId } from '@shared/app/credits'
import {
  APP_AUTHOR_URL,
  APP_DESCRIPTION,
  APP_LICENSE,
  APP_MAKER,
  APP_NAME,
  APP_VERSION,
} from '@shared/app/metadata'

const linkIcons: Record<AppLinkId, Component> = {
  website: Globe,
  github: GithubIcon,
  kofi: KofiIcon,
}

function openLink(url: string): void {
  void window.electron?.openExternal(url)
}
</script>

<template>
  <div class="px-3">
    <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-raised)] px-4 py-4">
      <p class="text-[15px] font-semibold text-[var(--color-fg)]">{{ APP_NAME }}</p>
      <p class="mt-0.5 text-[12px] text-[var(--color-fg-muted)]">Version {{ APP_VERSION }}</p>
      <p class="mt-3 text-[12px] leading-relaxed text-[var(--color-fg-muted)]">
        {{ APP_DESCRIPTION }}
      </p>
      <p class="mt-3 text-[12px] text-[var(--color-fg-muted)]">
        Built by
        <button
          type="button"
          class="focus-ring rounded text-[var(--color-accent)] hover:underline"
          @click="openLink(APP_AUTHOR_URL)"
        >
          {{ APP_MAKER }}
        </button>
        · {{ APP_LICENSE }} License
      </p>
    </div>

    <section class="mt-5">
      <h3
        class="pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
      >
        Links
      </h3>
      <ul class="space-y-0.5">
        <li v-for="link in APP_LINKS" :key="link.url">
          <button
            type="button"
            class="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] text-[var(--color-accent)] transition-colors hover:bg-[var(--color-hover)]"
            @click="openLink(link.url)"
          >
            <component :is="linkIcons[link.id]" :size="15" class="shrink-0" />
            {{ link.label }}
          </button>
        </li>
      </ul>
    </section>

    <section class="mt-5">
      <h3
        class="pb-1 text-[11px] font-semibold tracking-wide text-[var(--color-fg-subtle)] uppercase"
      >
        Open source
      </h3>
      <p class="mb-2 text-[12px] text-[var(--color-fg-muted)]">
        Git Light is made possible by these projects and their contributors.
      </p>
      <ul class="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
        <li
          v-for="credit in THIRD_PARTY_CREDITS"
          :key="credit.name"
          class="flex items-center justify-between gap-3 px-3 py-2"
        >
          <button
            type="button"
            class="focus-ring min-w-0 truncate text-left text-[13px] text-[var(--color-fg)] hover:text-[var(--color-accent)]"
            @click="openLink(credit.url)"
          >
            {{ credit.name }}
          </button>
          <span class="shrink-0 text-[11px] text-[var(--color-fg-subtle)]">{{ credit.license }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
