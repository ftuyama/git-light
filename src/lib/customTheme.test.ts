import { describe, expect, it } from 'vitest'
import {
  CUSTOM_THEME_COLOR_KEYS,
  DEFAULT_CUSTOM_THEME,
  customThemeCssVars,
  isHexColor,
  sanitizeCustomTheme,
} from './customTheme'

describe('isHexColor', () => {
  it('accepts six-digit hex colors in either case', () => {
    expect(isHexColor('#12151a')).toBe(true)
    expect(isHexColor('#ABCDEF')).toBe(true)
  })

  it('rejects other values', () => {
    expect(isHexColor('#fff')).toBe(false)
    expect(isHexColor('red')).toBe(false)
    expect(isHexColor(null)).toBe(false)
    expect(isHexColor(123456)).toBe(false)
  })
})

describe('sanitizeCustomTheme', () => {
  it('returns defaults for missing or invalid input', () => {
    expect(sanitizeCustomTheme(null)).toEqual(DEFAULT_CUSTOM_THEME)
    expect(sanitizeCustomTheme('nope')).toEqual(DEFAULT_CUSTOM_THEME)
  })

  it('keeps valid colors and falls back per key', () => {
    const theme = sanitizeCustomTheme({ app: '#000000', accent: 'not-a-color' })
    expect(theme.app).toBe('#000000')
    expect(theme.accent).toBe(DEFAULT_CUSTOM_THEME.accent)
    expect(theme.panel).toBe(DEFAULT_CUSTOM_THEME.panel)
  })

  it('normalizes colors to lowercase', () => {
    expect(sanitizeCustomTheme({ fg: '#E6EDF3' }).fg).toBe('#e6edf3')
  })
})

describe('customThemeCssVars', () => {
  it('maps every base color to its --custom-* variable', () => {
    const vars = customThemeCssVars(DEFAULT_CUSTOM_THEME)
    expect(Object.keys(vars)).toHaveLength(CUSTOM_THEME_COLOR_KEYS.length)
    expect(vars['--custom-app']).toBe(DEFAULT_CUSTOM_THEME.app)
    expect(vars['--custom-accent']).toBe(DEFAULT_CUSTOM_THEME.accent)
  })
})
