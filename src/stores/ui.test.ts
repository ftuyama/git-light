import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from './ui'

beforeEach(() => {
  setActivePinia(createPinia())
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
