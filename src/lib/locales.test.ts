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
    expect(isAppLocale('it')).toBe(false)
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

  it('maps Spanish variants', () => {
    expect(normalizeLocale('es')).toBe('es')
    expect(normalizeLocale('es-ES')).toBe('es')
    expect(normalizeLocale('es-419')).toBe('es')
  })

  it('maps French variants', () => {
    expect(normalizeLocale('fr')).toBe('fr')
    expect(normalizeLocale('fr-FR')).toBe('fr')
    expect(normalizeLocale('fr-CA')).toBe('fr')
  })

  it('maps German variants', () => {
    expect(normalizeLocale('de')).toBe('de')
    expect(normalizeLocale('de-DE')).toBe('de')
    expect(normalizeLocale('de-AT')).toBe('de')
    expect(normalizeLocale('de-CH')).toBe('de')
  })

  it('maps Japanese variants', () => {
    expect(normalizeLocale('ja')).toBe('ja')
    expect(normalizeLocale('ja-JP')).toBe('ja')
  })

  it('returns null for unsupported or empty input', () => {
    expect(normalizeLocale('it-IT')).toBeNull()
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
