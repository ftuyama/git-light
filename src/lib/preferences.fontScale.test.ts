import { describe, expect, it } from 'vitest'
import {
  clampFontScale,
  DEFAULT_FONT_SCALE,
  FONT_SCALE_OPTIONS,
  defaultPreferences,
  mergePreferences,
} from './preferences'

describe('fontScale preference', () => {
  it('defaults to 100%', () => {
    expect(DEFAULT_FONT_SCALE).toBe(1)
    expect(defaultPreferences().fontScale).toBe(1)
    expect(mergePreferences(null).fontScale).toBe(1)
  })

  it('keeps every offered option', () => {
    for (const option of FONT_SCALE_OPTIONS) {
      expect(clampFontScale(option)).toBe(option)
      expect(mergePreferences({ fontScale: option }).fontScale).toBe(option)
    }
  })

  it('falls back to the default for unknown or invalid values', () => {
    expect(clampFontScale(1.234)).toBe(1)
    expect(clampFontScale('1.25')).toBe(1)
    expect(clampFontScale(undefined)).toBe(1)
    expect(clampFontScale(Number.NaN)).toBe(1)
    expect(mergePreferences({ fontScale: 9 }).fontScale).toBe(1)
  })
})
