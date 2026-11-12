import { computed } from 'vue'
import type { MenuItem } from '@/components/ui/menu'
import { SECTION_KEYS, SECTION_LABEL_KEYS } from '@/lib/preferences'
import { translate } from '@/locales'
import { useUiStore } from '@/stores/ui'

export function useSidebarSectionMenu() {
  const ui = useUiStore()

  const sectionMenu = computed<MenuItem[]>(() =>
    SECTION_KEYS.map((key) => ({
      label: translate(SECTION_LABEL_KEYS[key]),
      checked: ui.isSectionVisible(key),
      onSelect: () => ui.toggleSectionVisible(key),
    })),
  )

  return { sectionMenu }
}
