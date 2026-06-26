import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { MenuItem } from '@/components/ui/menu'
import type { CommitColumnWidthKey } from '@/lib/preferences'
import { useUiStore } from '@/stores/ui'

const ROW_HORIZONTAL_PADDING = 24

export function useCommitGraphColumns() {
  const ui = useUiStore()
  const { columns, columnWidths } = storeToRefs(ui)

  const refsColumnWidth = computed(() => columnWidths.value.refs)
  const graphColumnWidth = computed(() => columnWidths.value.graph)

  const columnMenu = computed<MenuItem[]>(() => [
    {
      label: 'Author',
      checked: ui.isColumnVisible('author'),
      onSelect: () => ui.toggleColumn('author'),
    },
    {
      label: 'SHA',
      checked: ui.isColumnVisible('sha'),
      onSelect: () => ui.toggleColumn('sha'),
    },
    {
      label: 'When',
      checked: ui.isColumnVisible('when'),
      onSelect: () => ui.toggleColumn('when'),
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
