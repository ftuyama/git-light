import { afterEach, describe, expect, it } from 'vitest'
import { applyLocale } from '@/lib/locales'
import {
  APP_ZOOM_MAX,
  APP_ZOOM_MIN,
  appMenuLabels,
  bindingToAccelerator,
  clampZoom,
  helpItems,
  nextZoom,
} from './appMenu'

afterEach(() => {
  applyLocale('en')
})

describe('tauri app menu', () => {
  it('exposes stable item labels', () => {
    const labels = appMenuLabels()
    expect(labels.checkForUpdates).toBe('Check for Updates…')
    expect(labels.quit).toBe('Quit Git Light')
    expect(labels.settings).toBe('Settings…')
    expect(labels.file).toBe('File')
    expect(labels.view).toBe('View')
    expect(labels.window).toBe('Window')
  })

  it('follows the active locale instead of freezing labels at import time', () => {
    applyLocale('pt-BR')
    const labels = appMenuLabels()
    expect(labels.quit).toBe('Encerrar Git Light')
    expect(labels.settings).toBe('Configurações…')
    expect(labels.file).toBe('Arquivo')
  })

  it('links help entries to https urls', () => {
    expect(helpItems()).toHaveLength(4)
    for (const item of helpItems()) {
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
