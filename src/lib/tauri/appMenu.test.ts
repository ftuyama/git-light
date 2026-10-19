import { describe, expect, it } from 'vitest'
import {
  APP_ZOOM_MAX,
  APP_ZOOM_MIN,
  HELP_ITEMS,
  appMenuLabels,
  bindingToAccelerator,
  clampZoom,
  nextZoom,
} from './appMenu'

describe('tauri app menu', () => {
  it('exposes stable item labels', () => {
    expect(appMenuLabels.checkForUpdates).toBe('Check for Updates…')
    expect(appMenuLabels.quit).toBe('Quit Git Light')
    expect(appMenuLabels.settings).toBe('Settings…')
    expect(appMenuLabels.file).toBe('File')
    expect(appMenuLabels.view).toBe('View')
    expect(appMenuLabels.window).toBe('Window')
  })

  it('links help entries to https urls', () => {
    expect(HELP_ITEMS).toHaveLength(4)
    for (const item of HELP_ITEMS) {
      expect(item.url.startsWith('https://')).toBe(true)
    }
  })

  it('converts keybindings to menu accelerators', () => {
    expect(bindingToAccelerator({ key: 't', ctrlMeta: true, shift: false, alt: false })).toBe(
      'CmdOrCtrl+T',
    )
    expect(bindingToAccelerator({ key: 't', ctrlMeta: true, shift: true, alt: false })).toBe(
      'CmdOrCtrl+Shift+T',
    )
    expect(bindingToAccelerator({ key: 'tab', ctrlMeta: true, shift: false, alt: false })).toBe(
      'CmdOrCtrl+Tab',
    )
    expect(bindingToAccelerator({ key: '=', ctrlMeta: true, shift: false, alt: true })).toBe(
      'CmdOrCtrl+Alt+Equal'
    )
    // Unsupported standalone "+" is skipped rather than producing a bad accelerator.
    expect(bindingToAccelerator({ key: '+', ctrlMeta: true, shift: false, alt: false })).toBeNull()
  })

  it('clamps and steps the webview zoom', () => {
    expect(clampZoom(0.2)).toBe(APP_ZOOM_MIN)
    expect(clampZoom(5)).toBe(APP_ZOOM_MAX)
    expect(clampZoom(1.234)).toBe(1.23)
    expect(nextZoom(1, 1)).toBe(1.1)
    expect(nextZoom(1, -1)).toBe(0.9)
    expect(nextZoom(APP_ZOOM_MAX, 1)).toBe(APP_ZOOM_MAX)
    expect(nextZoom(APP_ZOOM_MIN, -1)).toBe(APP_ZOOM_MIN)
  })
})
