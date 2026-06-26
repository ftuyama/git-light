import { afterEach, describe, expect, it, vi } from 'vitest'
import { mergePreferences } from './preferences'
import { isThemePreference, resolveTheme } from './themes'

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
  })

  it('resolves system to default when OS prefers dark', () => {
    mockMatchMedia(true)
    expect(resolveTheme('system')).toBe('default')
  })

  it('resolves system to light when OS prefers light', () => {
    mockMatchMedia(false)
    expect(resolveTheme('system')).toBe('light')
  })
})

describe('isThemePreference', () => {
  it('accepts valid theme preferences', () => {
    expect(isThemePreference('default')).toBe(true)
    expect(isThemePreference('dracula')).toBe(true)
    expect(isThemePreference('light')).toBe(true)
    expect(isThemePreference('claude')).toBe(true)
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

  it('falls back to default for invalid theme', () => {
    expect(mergePreferences({ theme: 'invalid' as never }).theme).toBe('default')
  })
})
