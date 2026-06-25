<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from 'reka-ui'
import { ChevronRight } from '@lucide/vue'
import {
  MENU_CONTENT_CLASS,
  MENU_ITEM_CLASS,
  MENU_ITEM_DANGER_CLASS,
  type MenuItem,
} from './menu'

defineProps<{ items: MenuItem[] }>()
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent :class="MENU_CONTENT_CLASS">
        <template v-for="(item, index) in items" :key="index">
          <ContextMenuSeparator
            v-if="item.separator"
            class="my-1 h-px bg-[var(--color-border)]"
          />
          <ContextMenuSub v-else-if="item.children">
            <ContextMenuSubTrigger
              :class="MENU_ITEM_CLASS"
              class="data-[state=open]:bg-[var(--color-hover)]"
            >
              <component v-if="item.icon" :is="item.icon" :size="15" />
              <span class="flex-1">{{ item.label }}</span>
              <ChevronRight :size="14" class="text-[var(--color-fg-subtle)]" />
            </ContextMenuSubTrigger>
            <ContextMenuPortal>
              <ContextMenuSubContent :class="MENU_CONTENT_CLASS" :side-offset="2">
                <ContextMenuItem
                  v-for="(child, childIndex) in item.children"
                  :key="childIndex"
                  :class="child.danger ? MENU_ITEM_DANGER_CLASS : MENU_ITEM_CLASS"
                  @select="child.onSelect?.()"
                >
                  <component v-if="child.icon" :is="child.icon" :size="15" />
                  <span class="flex-1">{{ child.label }}</span>
                  <kbd
                    v-if="child.shortcut"
                    class="font-mono text-[10px] text-[var(--color-fg-subtle)] group-data-[highlighted]:text-white/70"
                  >
                    {{ child.shortcut }}
                  </kbd>
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuPortal>
          </ContextMenuSub>
          <ContextMenuItem
            v-else
            :class="item.danger ? MENU_ITEM_DANGER_CLASS : MENU_ITEM_CLASS"
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
          </ContextMenuItem>
        </template>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
