/**
 * Locale contract shared by the UI, the preference store and the vue-i18n
 * instance. Deliberately free of vue-i18n imports so node-side tests and the
 * Pinia store can use it without pulling the renderer runtime in.
 *
 * The active locale lives here (module scope) because non-component code such
 * as `format.ts` needs it synchronously; `src/locales/index.ts` registers the
 * applier that actually swaps the vue-i18n messages and `<html lang>`.
 */
export const APP_LOCALES = ['en', 'pt-BR', 'zh-CN'] as const

export type AppLocale = (typeof APP_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'en'

/** Native names, intentionally untranslated: each language lists itself. */
export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  'pt-BR': 'Português (Brasil)',
  'zh-CN': '简体中文',
}

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value)
}

/**
 * Maps a BCP-47 tag from the OS/browser onto a supported locale. Returns
 * `null` when nothing matches, so callers can decide whether to fall back.
 */
export function normalizeLocale(raw: string | null | undefined): AppLocale | null {
  if (!raw) return null
  const tag = raw.trim().replace(/_/g, '-').toLowerCase()
  if (!tag) return null
  if (tag === 'en' || tag.startsWith('en-')) return 'en'
  // Any Portuguese variant (pt, pt-BR, pt-PT) reads fine in pt-BR today.
  if (tag === 'pt' || tag.startsWith('pt-')) return 'pt-BR'
  // Simplified Chinese: zh, zh-CN, zh-Hans, zh-SG. Traditional (zh-TW/HK/Hant)
  // is a different catalog we do not ship yet, so it falls through.
  if (tag === 'zh' || tag === 'zh-cn' || tag === 'zh-hans' || tag === 'zh-sg') return 'zh-CN'
  return null
}

/** Best-effort locale from the browser/navigator, used outside Tauri. */
export function detectBrowserLocale(): AppLocale | null {
  if (typeof navigator === 'undefined') return null
  const candidates = [...(navigator.languages ?? []), navigator.language]
  for (const candidate of candidates) {
    const resolved = normalizeLocale(candidate)
    if (resolved) return resolved
  }
  return null
}

let currentLocale: AppLocale = DEFAULT_LOCALE
let applier: ((locale: AppLocale) => void) | null = null

/** Registered by `src/locales/index.ts` once vue-i18n is installed. */
export function registerLocaleApplier(fn: (locale: AppLocale) => void): void {
  applier = fn
  fn(currentLocale)
}

/** Switches the active locale everywhere it is observable. */
export function applyLocale(locale: AppLocale): void {
  currentLocale = locale
  applier?.(locale)
}

/** Locale currently applied to the UI; safe to read from plain modules. */
export function getAppLocale(): AppLocale {
  return currentLocale
}
