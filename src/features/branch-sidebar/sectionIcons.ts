import type { Component } from 'vue'
import { Cloud, Inbox, Laptop, Star, Tag, TreePine } from '@lucide/vue'
import type { SectionKey } from '@/lib/preferences'

/** Icons shared by the expanded sidebar section headers and the collapsed rail. */
export const SECTION_ICONS: Record<SectionKey, Component> = {
  favorites: Star,
  localBranches: Laptop,
  remoteBranches: Cloud,
  tags: Tag,
  stashes: Inbox,
  worktrees: TreePine,
}
