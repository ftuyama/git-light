import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { MenuItem } from '@/components/ui/menu'
import type { CommitColumnWidthKey } from '@/lib/preferences'
import { translate } from '@/locales'
import { useUiStore } from '@/stores/ui'

export const ROW_HORIZONTAL_PADDING = 24
/** Matches Tailwind `pl-3` on commit graph rows. */
export const ROW_LEFT_PADDING = ROW_HORIZONTAL_PADDING / 2

export function useCommitGraphColumns() {
  const ui = useUiStore()
  const { columns, columnWidths } = storeToRefs(ui)

  const refsColumnWidth = computed(() => columnWidths.value.refs)
  const graphColumnWidth = computed(() => columnWidths.value.graph)

  const columnMenu = computed<MenuItem[]>(() => [
    {
      label: translate('common.labels.author'),
      checked: ui.isColumnVisible('author'),
      onSelect: () => ui.toggleColumn('author'),
    },
    {
      label: translate('graph.columnMenu.sha'),
      checked: ui.isColumnVisible('sha'),
      onSelect: () => ui.toggleColumn('sha'),
    },
    {
      label: translate('graph.columnMenu.when'),
      checked: ui.isColumnVisible('when'),
      onSelect: () => ui.toggleColumn('when'),
    },
    { separator: true },
    {
      label: translate('graph.columnMenu.timeIndicators'),
      checked: ui.showTimeMarkers,
      onSelect: () => ui.toggleTimeMarkers(),
    },
    {
      label: translate('graph.columnMenu.mergeIndicators'),
      checked: ui.showMergeIndicators,
      onSelect: () => ui.toggleMergeIndicators(),
    },
  ])

  const rowContentWidth = computed(() => {
    let width =
      refsColumnWidth.value + graphColumnWidth.value + columnWidths.value.commit
    if (columns.value.author) width += columnWidths.value.author
    if (columns.value.sha) width += columnWidths.value.sha
    if (columns.value.when) width += columnWidths.value.when
    return width + ROW_HORIZONTAL_PADDING
  })

  function resizeColumn(key: CommitColumnWidthKey, deltaX: number): void {
    ui.setColumnWidth(key, columnWidths.value[key] + deltaX)
  }

  return {
    columns,
    columnWidths,
    refsColumnWidth,
    graphColumnWidth,
    columnMenu,
    rowContentWidth,
    resizeColumn,
  }
}
