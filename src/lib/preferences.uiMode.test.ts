import { describe, expect, it } from 'vitest'
import { defaultPreferences, mergePreferences } from './preferences'

describe('mergePreferences uiMode', () => {
  it('defaults to advanced when saved is null', () => {
    expect(mergePreferences(null).uiMode).toBe('advanced')
  })

  it('preserves basic when explicitly saved', () => {
    expect(mergePreferences({ uiMode: 'basic' }).uiMode).toBe('basic')
  })

  it('preserves advanced when explicitly saved', () => {
    expect(mergePreferences({ uiMode: 'advanced' }).uiMode).toBe('advanced')
  })

  it('falls back to advanced for invalid uiMode', () => {
    expect(mergePreferences({ uiMode: 'expert' as 'basic' }).uiMode).toBe('advanced')
    expect(mergePreferences({ uiMode: undefined }).uiMode).toBe('advanced')
  })

  it('includes advanced in defaultPreferences', () => {
    expect(defaultPreferences().uiMode).toBe('advanced')
  })
})
