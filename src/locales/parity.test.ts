import { describe, expect, it } from 'vitest'
import { APP_LOCALES, DEFAULT_LOCALE } from '@/lib/locales'

/**
 * Guards the catalogs against drift: every locale must expose exactly the same
 * keys as English. New strings land in `en` first, then in every other locale
 * in the same change — this test is what makes that mechanical rule enforceable.
 */
const catalogModules = import.meta.glob('./*/[a-z]*.json', { eager: true }) as Record<
  string,
  { default: unknown }
>

type Catalog = Record<string, Record<string, unknown>>

const catalogs: Catalog = {}

for (const [path, module] of Object.entries(catalogModules)) {
  const match = /^\.\/([^/]+)\/([^/]+)\.json$/.exec(path)
  if (!match) continue
  const [, locale, domain] = match
  catalogs[locale] ??= {}
  catalogs[locale]![domain!] = module.default as Record<string, unknown>
}

const LOCALES = APP_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE)

function flatten(value: unknown, prefix = ''): Map<string, string> {
  const flat = new Map<string, string>()
  if (value === null || typeof value !== 'object') {
    flat.set(prefix, String(value))
    return flat
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${key}` : key
    if (child !== null && typeof child === 'object') {
      for (const [k, v] of flatten(child, next)) flat.set(k, v)
    } else {
      flat.set(next, String(child))
    }
  }
  return flat
}

const english = catalogs[DEFAULT_LOCALE] ?? {}
const englishDomains = Object.keys(english).sort()

describe('locale catalogs', () => {
  it('ships every domain for the default locale', () => {
    expect(englishDomains.length).toBeGreaterThan(0)
  })

  for (const locale of LOCALES) {
    it(`${locale} has the same domains as ${DEFAULT_LOCALE}`, () => {
      expect(Object.keys(catalogs[locale] ?? {}).sort()).toEqual(englishDomains)
    })

    it(`${locale} has the same keys as ${DEFAULT_LOCALE}`, () => {
      const missing: string[] = []
      const extra: string[] = []
      for (const domain of englishDomains) {
        const base = flatten(english[domain])
        const target = flatten(catalogs[locale]?.[domain] ?? {})
        for (const key of base.keys()) {
          if (!target.has(key)) missing.push(`${domain}:${key}`)
        }
        for (const key of target.keys()) {
          if (!base.has(key)) extra.push(`${domain}:${key}`)
        }
      }
      expect({ missing, extra }).toEqual({ missing: [], extra: [] })
    })

    it(`${locale} has no empty translations`, () => {
      const empty: string[] = []
      for (const domain of englishDomains) {
        for (const [key, value] of flatten(catalogs[locale]?.[domain] ?? {})) {
          if (!value.trim()) empty.push(`${domain}:${key}`)
        }
      }
      expect(empty).toEqual([])
    })
  }
})
