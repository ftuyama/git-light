import { format, formatDistanceToNowStrict } from 'date-fns'
import { enUS, ptBR, zhCN, type Locale } from 'date-fns/locale'
import { getAppLocale, type AppLocale } from './locales'

const DATE_FNS_LOCALES: Record<AppLocale, Locale> = {
  en: enUS,
  'pt-BR': ptBR,
  'zh-CN': zhCN,
}

/** date-fns locale for an app locale, defaulting to the active one. */
export function dateFnsLocale(locale: AppLocale = getAppLocale()): Locale {
  return DATE_FNS_LOCALES[locale] ?? enUS
}

export function relativeTime(date: Date | number, locale: AppLocale = getAppLocale()): string {
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: dateFnsLocale(locale) })
}

/** Localized absolute timestamp, e.g. "Nov 12, 2026, 2:30 PM" / "2026年11月12日 14:30". */
export function fullTimestamp(date: Date | number, locale: AppLocale = getAppLocale()): string {
  return format(date, 'PP p', { locale: dateFnsLocale(locale) })
}
