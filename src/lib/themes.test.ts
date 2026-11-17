import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultPreferences, mergePreferences } from './preferences'
import { isThemePreference, resolveTheme, themeAppColor } from './themes'

function mockMatchMedia(dark: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('dark') ? dark : !dark,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveTheme', () => {
  it('returns named themes unchanged', () => {
    expect(resolveTheme('default')).toBe('default')
    expect(resolveTheme('dracula')).toBe('dracula')
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('claude')).toBe('claude')
    expect(resolveTheme('nord')).toBe('nord')
    expect(resolveTheme('gruvbox')).toBe('gruvbox')
    expect(resolveTheme('rose-pine')).toBe('rose-pine')
    expect(resolveTheme('one-dark')).toBe('one-dark')
    expect(resolveTheme('solarized-light')).toBe('solarized-light')
    expect(resolveTheme('custom')).toBe('custom')
  })

  it('resolves system to default when OS prefers dark', () => {
    mockMatchMedia(true)
    expect(resolveTheme('system')).toBe('default')
  })

  it('resolves system to light when OS prefers light', () => {
    mockMatchMedia(false)
    expect(resolveTheme('system')).toBe('light')
  })

  it('resolves system to light when the preference cannot be read', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(resolveTheme('system')).toBe('light')
  })
})

describe('isThemePreference', () => {
  it('accepts valid theme preferences', () => {
    expect(isThemePreference('default')).toBe(true)
    expect(isThemePreference('dracula')).toBe(true)
    expect(isThemePreference('light')).toBe(true)
    expect(isThemePreference('claude')).toBe(true)
    expect(isThemePreference('nord')).toBe(true)
    expect(isThemePreference('gruvbox')).toBe(true)
    expect(isThemePreference('rose-pine')).toBe(true)
    expect(isThemePreference('one-dark')).toBe(true)
    expect(isThemePreference('solarized-light')).toBe(true)
    expect(isThemePreference('custom')).toBe(true)
    expect(isThemePreference('system')).toBe(true)
  })

  it('rejects invalid values', () => {
    expect(isThemePreference('dark')).toBe(false)
    expect(isThemePreference(null)).toBe(false)
  })
})

describe('mergePreferences sections', () => {
  it('restores saved sidebar section expansion state', () => {
    const merged = mergePreferences({
      sections: { tags: true, stashes: false, worktrees: true },
    })
    expect(merged.sections.tags).toBe(true)
    expect(merged.sections.stashes).toBe(false)
    expect(merged.sections.worktrees).toBe(true)
  })

  it('fills missing section keys with defaults', () => {
    const merged = mergePreferences({ sections: { tags: true } })
    expect(merged.sections.favorites).toBe(true)
    expect(merged.sections.localBranches).toBe(true)
    expect(merged.sections.remoteBranches).toBe(false)
    expect(merged.sections.tags).toBe(true)
    expect(merged.sections.stashes).toBe(false)
    expect(merged.sections.worktrees).toBe(false)
  })
})

describe('mergePreferences theme', () => {
  it('preserves a valid theme', () => {
    expect(mergePreferences({ theme: 'dracula' }).theme).toBe('dracula')
  })

  it('falls back to the system preference for invalid theme', () => {
    expect(mergePreferences({ theme: 'invalid' as never }).theme).toBe('system')
  })

  it('defaults to following the system theme', () => {
    expect(defaultPreferences().theme).toBe('system')
  })

  it('restores custom theme colors', () => {
    const merged = mergePreferences({
      theme: 'custom',
      customTheme: {
        app: '#000000',
        panel: '#111111',
        fg: '#ffffff',
        accent: '#ff0000',
        success: '#00ff00',
        warning: '#ffaa00',
        danger: '#ff5555',
      },
    })
    expect(merged.theme).toBe('custom')
    expect(merged.customTheme.app).toBe('#000000')
    expect(merged.customTheme.accent).toBe('#ff0000')
  })

  it('fills missing custom colors with defaults', () => {
    const merged = mergePreferences({ customTheme: { app: '#000000' } as never })
    expect(merged.customTheme.app).toBe('#000000')
    expect(merged.customTheme.panel).toBe('#1b2028')
  })
})

describe('themeAppColor', () => {
  it('returns the custom background when the custom theme is active', () => {
    const custom = {
      app: '#101820',
      panel: '#1b2028',
      fg: '#e6edf3',
      accent: '#6e9fff',
      success: '#3fb950',
      warning: '#f0883e',
      danger: '#f85149',
    }
    expect(themeAppColor('custom', custom)).toBe('#101820')
  })

  it('returns the palette background for named themes', () => {
    expect(themeAppColor('nord')).toBe('#2e3440')
    expect(themeAppColor('solarized-light')).toBe('#fdf6e3')
  })
})
