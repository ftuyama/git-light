<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, type MenuItem } from './menu'

withDefaults(
  defineProps<{
    items: MenuItem[]
    align?: 'start' | 'center' | 'end'
    side?: 'top' | 'bottom'
  }>(),
  { align: 'start', side: 'bottom' },
)
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <slot />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :align="align"
        :side="side"
        :side-offset="6"
        :class="MENU_CONTENT_CLASS"
      >
        <template v-for="(item, index) in items" :key="index">
          <DropdownMenuSeparator
            v-if="item.separator"
            class="my-1 h-px bg-[var(--color-border)]"
          />
          <DropdownMenuItem
            v-else
            :class="MENU_ITEM_CLASS"
            :disabled="item.disabled"
            @select="item.onSelect?.()"
          >
            <component v-if="item.icon" :is="item.icon" :size="15" />
            <span class="flex-1">{{ item.label }}</span>
            <kbd
              v-if="item.shortcut"
              class="font-mono text-[10px] text-[var(--color-fg-subtle)] group-data-[highlighted]:text-white/70"
            >
              {{ item.shortcut }}
            </kbd>
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
