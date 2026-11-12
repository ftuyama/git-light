import { computed, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { MenuItem } from '@/components/ui/menu'
import type { CommitColumnWidthKey } from '@/lib/preferences'
import { useUiStore } from '@/stores/ui'

export const ROW_HORIZONTAL_PADDING = 24
/** Matches Tailwind `pl-3` on commit graph rows. */
export const ROW_LEFT_PADDING = ROW_HORIZONTAL_PADDING / 2
export function useCommitGraphColumns(scrollbarWidth: Ref<number>) {
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
    { separator: true },
    {
      label: 'Time indicators',
      checked: ui.showTimeMarkers,
      onSelect: () => ui.toggleTimeMarkers(),
    },
    {
      label: 'Merge indicators',
      checked: ui.showMergeIndicators,
      onSelect: () => ui.toggleMergeIndicators(),
    },
  ])

  /**
   * Rightmost visible column. It stretches to fill the remaining viewport
   * width so the graph always occupies 100% of the available space.
   */
  const fillColumn = computed<CommitColumnWidthKey>(() => {
    if (columns.value.when) return 'when'
    if (columns.value.sha) return 'sha'
    if (columns.value.author) return 'author'
    return 'commit'
  })

  const columnsWidth = computed(() => {
    let width =
      refsColumnWidth.value + graphColumnWidth.value + columnWidths.value.commit
    if (columns.value.author) width += columnWidths.value.author
    if (columns.value.sha) width += columnWidths.value.sha
    if (columns.value.when) width += columnWidths.value.when
    return width
  })

  /**
   * The header scroll viewport spans the full width; the body loses the
   * vertical scrollbar. Both include that difference as padding so the header
   * and rows keep identical column areas all the way to the right edge.
   */
  const headerContentWidth = computed(
    () => columnsWidth.value + ROW_HORIZONTAL_PADDING + scrollbarWidth.value,
  )

  /** Rows fill the full body width minus the same 12px edge padding. */
  const rowContentWidth = computed(
    () => columnsWidth.value + ROW_HORIZONTAL_PADDING,
  )

  function resizeColumn(key: CommitColumnWidthKey, deltaX: number): void {
    ui.setColumnWidth(key, columnWidths.value[key] + deltaX)
  }

  return {
    columns,
    columnWidths,
    refsColumnWidth,
    graphColumnWidth,
    columnMenu,
    fillColumn,
    headerContentWidth,
    rowContentWidth,
    resizeColumn,
  }
}
