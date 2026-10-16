import { describe, expect, it } from 'vitest'
import { HELP_ITEMS, appMenuLabels } from './appMenu'

describe('tauri app menu', () => {
  it('exposes stable item ids', () => {
    expect(appMenuLabels.checkForUpdates).toBe('Check for Updates…')
    expect(appMenuLabels.quit).toBe('Quit Git Light')
  })

  it('links help entries to https urls', () => {
    expect(HELP_ITEMS).toHaveLength(2)
    for (const item of HELP_ITEMS) {
      expect(item.url.startsWith('https://')).toBe(true)
    }
  })
})
