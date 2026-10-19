<script setup lang="ts">
import {
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuItemIndicator,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from 'reka-ui'
import { Check, ChevronRight } from '@lucide/vue'
import {
  MENU_CONTENT_CLASS,
  MENU_ITEM_CLASS,
  MENU_ITEM_DANGER_CLASS,
  MENU_SUB_CONTENT_CLASS,
  type MenuItem,
} from './menu'

defineProps<{ items: MenuItem[] }>()
</script>

<template>
  <ContextMenuRoot :modal="false">
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
              @pointerenter="item.onHover?.()"
            >
              <component v-if="item.icon" :is="item.icon" :size="15" />
              <span class="flex-1">{{ item.label }}</span>
              <ChevronRight :size="14" class="text-[var(--color-fg-subtle)]" />
            </ContextMenuSubTrigger>
            <ContextMenuPortal>
              <ContextMenuSubContent :class="MENU_SUB_CONTENT_CLASS">
                <template v-for="(child, childIndex) in item.children" :key="childIndex">
                  <ContextMenuCheckboxItem
                    v-if="child.checked !== undefined"
                    :model-value="child.checked"
                    :class="MENU_ITEM_CLASS"
                    :disabled="child.disabled"
                    @select.prevent="child.onSelect?.()"
                    @pointerenter="child.onHover?.()"
                  >
                    <ContextMenuItemIndicator class="flex w-4 items-center justify-center">
                      <Check :size="14" />
                    </ContextMenuItemIndicator>
                    <span class="flex-1">{{ child.label }}</span>
                  </ContextMenuCheckboxItem>
                  <ContextMenuItem
                    v-else
                    :class="child.danger ? MENU_ITEM_DANGER_CLASS : MENU_ITEM_CLASS"
                    :disabled="child.disabled"
                    @select="child.onSelect?.()"
                    @pointerenter="child.onHover?.()"
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
                </template>
              </ContextMenuSubContent>
            </ContextMenuPortal>
          </ContextMenuSub>
          <ContextMenuCheckboxItem
            v-else-if="item.checked !== undefined"
            :model-value="item.checked"
            :class="MENU_ITEM_CLASS"
            :disabled="item.disabled"
            @select.prevent="item.onSelect?.()"
            @pointerenter="item.onHover?.()"
          >
            <ContextMenuItemIndicator class="flex w-4 items-center justify-center">
              <Check :size="14" />
            </ContextMenuItemIndicator>
            <component v-if="item.icon" :is="item.icon" :size="15" />
            <span class="flex-1">{{ item.label }}</span>
          </ContextMenuCheckboxItem>
          <ContextMenuItem
            v-else
            :class="item.danger ? MENU_ITEM_DANGER_CLASS : MENU_ITEM_CLASS"
            :disabled="item.disabled"
            @select="item.onSelect?.()"
            @pointerenter="item.onHover?.()"
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
