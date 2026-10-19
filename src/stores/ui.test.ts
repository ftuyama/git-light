import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from './ui'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('sidebar section visibility', () => {
  it('shows every section by default', () => {
    const ui = useUiStore()
    for (const key of [
      'favorites',
      'localBranches',
      'remoteBranches',
      'tags',
      'stashes',
      'worktrees',
    ]) {
      expect(ui.isSectionVisible(key)).toBe(true)
    }
  })

  it('toggles and sets section visibility without touching collapse state', () => {
    const ui = useUiStore()
    expect(ui.isSectionOpen('tags')).toBe(false)

    ui.toggleSectionVisible('tags')
    expect(ui.isSectionVisible('tags')).toBe(false)
    expect(ui.isSectionOpen('tags')).toBe(false)

    ui.setSectionVisible('tags', true)
    expect(ui.isSectionVisible('tags')).toBe(true)
  })

  it('allows hiding every section', () => {
    const ui = useUiStore()
    for (const key of [
      'favorites',
      'localBranches',
      'remoteBranches',
      'tags',
      'stashes',
      'worktrees',
    ]) {
      ui.setSectionVisible(key, false)
      expect(ui.isSectionVisible(key)).toBe(false)
    }
  })

  it('derives a tri-state per section', () => {
    const ui = useUiStore()
    expect(ui.sectionState('tags')).toBe('collapsed')

    ui.setSectionState('tags', 'expanded')
    expect(ui.sectionState('tags')).toBe('expanded')

    ui.setSectionState('tags', 'collapsed')
    expect(ui.sectionState('tags')).toBe('collapsed')

    ui.setSectionState('tags', 'hidden')
    expect(ui.sectionState('tags')).toBe('hidden')
    expect(ui.isSectionVisible('tags')).toBe(false)
  })

  it('restores the remembered open state when unhiding a section', () => {
    const ui = useUiStore()
    ui.setSectionState('localBranches', 'expanded')
    ui.setSectionState('localBranches', 'hidden')
    ui.setSectionState('localBranches', 'hidden')
    expect(ui.sectionState('localBranches')).toBe('hidden')

    ui.setSectionState('localBranches', 'expanded')
    expect(ui.sectionState('localBranches')).toBe('expanded')
  })
})

describe('commit graph column widths', () => {
  it('clamps and resets widths', () => {
    const ui = useUiStore()
    ui.setColumnWidth('graph', 1)
    expect(ui.columnWidths.graph).toBe(56)

    ui.setColumnWidth('graph', 10_000)
    expect(ui.columnWidths.graph).toBe(360)

    ui.resetColumnWidths()
    expect(ui.columnWidths.graph).toBe(300)
  })
})

describe('auto sidebar toggle for diff view', () => {
  it('collapses an expanded sidebar and requests instant panes', () => {
    const ui = useUiStore()
    expect(ui.leftCollapsed).toBe(false)

    ui.autoCollapseLeftForDiff()

    expect(ui.leftCollapsed).toBe(true)
    expect(ui.suppressPaneAnimation).toBe(true)
  })

  it('ignores duplicate open notifications while a diff is active', () => {
    const ui = useUiStore()

    ui.autoCollapseLeftForDiff()
    ui.leftCollapsed = false // user manually re-expanded mid-diff
    ui.autoCollapseLeftForDiff()

    // Still tracking the original pre-diff state, not the manual toggle.
    ui.restoreLeftAfterDiff()
    expect(ui.leftCollapsed).toBe(false)
  })

  it('restores an expanded sidebar on diff close', () => {
    const ui = useUiStore()

    ui.autoCollapseLeftForDiff()
    ui.restoreLeftAfterDiff()

    expect(ui.leftCollapsed).toBe(false)
    expect(ui.suppressPaneAnimation).toBe(true)
    expect(ui.leftCollapsedBeforeDiff).toBeNull()
  })

  it('leaves an already-collapsed sidebar collapsed without animation', () => {
    const ui = useUiStore()
    ui.leftCollapsed = true

    ui.autoCollapseLeftForDiff()

    expect(ui.leftCollapsed).toBe(true)
    expect(ui.suppressPaneAnimation).toBe(false)

    ui.restoreLeftAfterDiff()

    expect(ui.leftCollapsed).toBe(true)
    expect(ui.leftCollapsedBeforeDiff).toBeNull()
  })

  it('ignores restore without a preceding auto-collapse', () => {
    const ui = useUiStore()

    ui.restoreLeftAfterDiff()

    expect(ui.leftCollapsed).toBe(false)
    expect(ui.suppressPaneAnimation).toBe(false)
  })
})
