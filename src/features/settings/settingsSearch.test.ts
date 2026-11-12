import { describe, expect, it } from 'vitest'
import {
  SETTINGS_CATEGORY_LABELS,
  buildSettingsSearchEntries,
  normalizeSettingsQuery,
  searchSettings,
} from './settingsSearch'

describe('buildSettingsSearchEntries', () => {
  it('hides advanced sidebar sections and shortcuts in basic mode', () => {
    const basic = buildSettingsSearchEntries({ isAdvanced: false })
    expect(basic.some((entry) => entry.id === 'sidebar-stashes')).toBe(false)
    expect(basic.some((entry) => entry.id === 'shortcut-openTerminal')).toBe(false)

    const advanced = buildSettingsSearchEntries({ isAdvanced: true })
    expect(advanced.some((entry) => entry.id === 'sidebar-stashes')).toBe(true)
    expect(advanced.some((entry) => entry.id === 'shortcut-openTerminal')).toBe(true)
  })

  it('includes every visible shortcut as a searchable entry', () => {
    const entries = buildSettingsSearchEntries({ isAdvanced: true })
    const shortcuts = entries.filter((entry) => entry.category === 'shortcuts')
    expect(shortcuts.length).toBeGreaterThan(0)
    expect(shortcuts[0]?.anchor).toMatch(/^settings-shortcut-/)
  })

  it('only produces anchors that render as DOM ids', () => {
    const entries = buildSettingsSearchEntries({ isAdvanced: true })
    for (const entry of entries) {
      expect(entry.anchor).toMatch(/^settings-/)
    }
  })
})

describe('searchSettings', () => {
  const entries = buildSettingsSearchEntries({ isAdvanced: true })

  it('returns no groups for an empty or whitespace query', () => {
    expect(searchSettings(entries, '')).toEqual([])
    expect(searchSettings(entries, '   ')).toEqual([])
  })

  it('finds settings by label', () => {
    const groups = searchSettings(entries, 'theme')
    expect(groups.map((group) => group.category)).toEqual(['appearance'])
    expect(groups[0]?.entries.map((entry) => entry.id)).toContain('theme')
    expect(groups[0]?.label).toBe(SETTINGS_CATEGORY_LABELS.appearance)
  })

  it('matches descriptions and keywords', () => {
    expect(searchSettings(entries, 'gravatar')[0]?.entries[0]?.id).toBe('remote-avatars')
    expect(searchSettings(entries, 'signingkey')[0]?.entries[0]?.id).toBe('sign-commit')
  })

  it('requires every term to match', () => {
    const groups = searchSettings(entries, 'graph width')
    expect(groups.flatMap((group) => group.entries).map((entry) => entry.id)).toEqual([
      'column-widths',
    ])
  })

  it('matches the category name, so a category query lists its settings', () => {
    const groups = searchSettings(entries, 'sync')
    expect(groups.map((group) => group.category)).toEqual(['sync'])
    expect(groups[0]?.entries[0]?.id).toBe('auto-fetch')
  })

  it('finds shortcuts by title and category', () => {
    const byTitle = searchSettings(entries, 'pull')
    expect(byTitle[0]?.category).toBe('shortcuts')
    expect(byTitle[0]?.entries.map((entry) => entry.id)).toContain('shortcut-pull')

    const byCategory = searchSettings(entries, 'keybinding')
    expect(byCategory[0]?.category).toBe('shortcuts')
  })

  it('is case and accent insensitive', () => {
    expect(normalizeSettingsQuery('ÁVATAR')).toBe('avatar')
    expect(searchSettings(entries, 'ÁVATAR').length).toBeGreaterThan(0)
  })
})
