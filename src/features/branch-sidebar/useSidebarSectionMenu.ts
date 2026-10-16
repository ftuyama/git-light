import { computed } from 'vue'
import type { MenuItem } from '@/components/ui/menu'
import { SECTION_KEYS, SECTION_LABELS } from '@/lib/preferences'
import { useUiStore } from '@/stores/ui'

export function useSidebarSectionMenu() {
  const ui = useUiStore()

  const sectionMenu = computed<MenuItem[]>(() =>
    SECTION_KEYS.map((key) => ({
      label: SECTION_LABELS[key],
      checked: ui.isSectionVisible(key),
      onSelect: () => ui.toggleSectionVisible(key),
    })),
  )

  return { sectionMenu }
}
