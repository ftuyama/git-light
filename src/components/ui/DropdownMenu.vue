<script setup lang="ts">
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from 'reka-ui'
import { Check, ChevronRight } from '@lucide/vue'
import {
  MENU_CONTENT_CLASS,
  MENU_ITEM_CLASS,
  MENU_ITEM_DANGER_CLASS,
  type MenuItem,
} from './menu'

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
          <DropdownMenuSub v-else-if="item.children">
            <DropdownMenuSubTrigger
              :class="MENU_ITEM_CLASS"
              class="data-[state=open]:bg-[var(--color-hover)]"
            >
              <component v-if="item.icon" :is="item.icon" :size="15" />
              <span class="flex-1">{{ item.label }}</span>
              <ChevronRight :size="14" class="text-[var(--color-fg-subtle)]" />
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent :class="MENU_CONTENT_CLASS" :side-offset="2">
                <template v-for="(child, childIndex) in item.children" :key="childIndex">
                  <DropdownMenuCheckboxItem
                    v-if="child.checked !== undefined"
                    :model-value="child.checked"
                    :class="MENU_ITEM_CLASS"
                    @select.prevent="child.onSelect?.()"
                  >
                    <DropdownMenuItemIndicator class="flex w-4 items-center justify-center">
                      <Check :size="14" />
                    </DropdownMenuItemIndicator>
                    <span class="flex-1">{{ child.label }}</span>
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuItem
                    v-else
                    :class="child.danger ? MENU_ITEM_DANGER_CLASS : MENU_ITEM_CLASS"
                    :disabled="child.disabled"
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
                  </DropdownMenuItem>
                </template>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          <DropdownMenuCheckboxItem
            v-else-if="item.checked !== undefined"
            :model-value="item.checked"
            :class="MENU_ITEM_CLASS"
            @select.prevent="item.onSelect?.()"
          >
            <DropdownMenuItemIndicator class="flex w-4 items-center justify-center">
              <Check :size="14" />
            </DropdownMenuItemIndicator>
            <component v-if="item.icon" :is="item.icon" :size="15" />
            <span class="flex-1">{{ item.label }}</span>
          </DropdownMenuCheckboxItem>
          <DropdownMenuItem
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
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
