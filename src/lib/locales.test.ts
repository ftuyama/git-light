import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  APP_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  applyLocale,
  getAppLocale,
  isAppLocale,
  normalizeLocale,
  registerLocaleApplier,
} from './locales'

afterEach(() => {
  applyLocale(DEFAULT_LOCALE)
})

describe('isAppLocale', () => {
  it('accepts every shipped locale', () => {
    for (const locale of APP_LOCALES) expect(isAppLocale(locale)).toBe(true)
  })

  it('rejects unknown or non-string values', () => {
    expect(isAppLocale('fr')).toBe(false)
    expect(isAppLocale('en-US')).toBe(false)
    expect(isAppLocale(null)).toBe(false)
    expect(isAppLocale(undefined)).toBe(false)
    expect(isAppLocale(42)).toBe(false)
  })
})

describe('normalizeLocale', () => {
  it('maps English variants', () => {
    expect(normalizeLocale('en')).toBe('en')
    expect(normalizeLocale('en-US')).toBe('en')
    expect(normalizeLocale('en_GB')).toBe('en')
  })

  it('maps every Portuguese variant to pt-BR', () => {
    expect(normalizeLocale('pt')).toBe('pt-BR')
    expect(normalizeLocale('pt-BR')).toBe('pt-BR')
    expect(normalizeLocale('pt-PT')).toBe('pt-BR')
  })

  it('maps only simplified Chinese', () => {
    expect(normalizeLocale('zh')).toBe('zh-CN')
    expect(normalizeLocale('zh-CN')).toBe('zh-CN')
    expect(normalizeLocale('zh-Hans')).toBe('zh-CN')
    expect(normalizeLocale('zh-SG')).toBe('zh-CN')
    expect(normalizeLocale('ZH_cn')).toBe('zh-CN')
    expect(normalizeLocale('zh-TW')).toBeNull()
    expect(normalizeLocale('zh-Hant')).toBeNull()
  })

  it('returns null for unsupported or empty input', () => {
    expect(normalizeLocale('fr-FR')).toBeNull()
    expect(normalizeLocale('')).toBeNull()
    expect(normalizeLocale(null)).toBeNull()
    expect(normalizeLocale(undefined)).toBeNull()
  })
})

describe('locale applier registry', () => {
  it('labels are native names, never keys', () => {
    for (const locale of APP_LOCALES) expect(LOCALE_LABELS[locale].length).toBeGreaterThan(1)
    expect(LOCALE_LABELS['pt-BR']).toContain('Português')
  })

  it('tracks the active locale and notifies the registered applier', () => {
    const applier = vi.fn()
    registerLocaleApplier(applier)
    expect(applier).toHaveBeenCalledWith(DEFAULT_LOCALE)

    applyLocale('zh-CN')
    expect(getAppLocale()).toBe('zh-CN')
    expect(applier).toHaveBeenLastCalledWith('zh-CN')
  })
})
