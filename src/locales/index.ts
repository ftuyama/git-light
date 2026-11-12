import { createI18n } from 'vue-i18n'
import { isTauri } from '@/lib/backend'
import {
  DEFAULT_LOCALE,
  detectBrowserLocale,
  normalizeLocale,
  registerLocaleApplier,
  type AppLocale,
} from '@/lib/locales'

import enBranches from './en/branches.json'
import enCommon from './en/common.json'
import enConflicts from './en/conflicts.json'
import enDiff from './en/diff.json'
import enErrors from './en/errors.json'
import enGraph from './en/graph.json'
import enMenu from './en/menu.json'
import enPalette from './en/palette.json'
import enRebase from './en/rebase.json'
import enSettings from './en/settings.json'
import enShell from './en/shell.json'
import enShortcuts from './en/shortcuts.json'
import enWorkingTree from './en/workingTree.json'

import ptBRBranches from './pt-BR/branches.json'
import ptBRCommon from './pt-BR/common.json'
import ptBRConflicts from './pt-BR/conflicts.json'
import ptBRDiff from './pt-BR/diff.json'
import ptBRErrors from './pt-BR/errors.json'
import ptBRGraph from './pt-BR/graph.json'
import ptBRMenu from './pt-BR/menu.json'
import ptBRPalette from './pt-BR/palette.json'
import ptBRRebase from './pt-BR/rebase.json'
import ptBRSettings from './pt-BR/settings.json'
import ptBRShell from './pt-BR/shell.json'
import ptBRShortcuts from './pt-BR/shortcuts.json'
import ptBRWorkingTree from './pt-BR/workingTree.json'

import zhCNBranches from './zh-CN/branches.json'
import zhCNCommon from './zh-CN/common.json'
import zhCNConflicts from './zh-CN/conflicts.json'
import zhCNDiff from './zh-CN/diff.json'
import zhCNErrors from './zh-CN/errors.json'
import zhCNGraph from './zh-CN/graph.json'
import zhCNMenu from './zh-CN/menu.json'
import zhCNPalette from './zh-CN/palette.json'
import zhCNRebase from './zh-CN/rebase.json'
import zhCNSettings from './zh-CN/settings.json'
import zhCNShell from './zh-CN/shell.json'
import zhCNShortcuts from './zh-CN/shortcuts.json'
import zhCNWorkingTree from './zh-CN/workingTree.json'

/**
 * Catalogs are split by feature domain so a change to the commit graph never
 * touches the settings file (and so parallel work stays conflict-free).
 * They are imported statically: the whole catalog is a few tens of KB, and
 * non-component code (`appMenu`, `format`, toasts) needs `t()` synchronously.
 */
const messages = {
  en: {
    common: enCommon,
    shell: enShell,
    graph: enGraph,
    branches: enBranches,
    workingTree: enWorkingTree,
    diff: enDiff,
    conflicts: enConflicts,
    rebase: enRebase,
    palette: enPalette,
    settings: enSettings,
    menu: enMenu,
    shortcuts: enShortcuts,
    errors: enErrors,
  },
  'pt-BR': {
    common: ptBRCommon,
    shell: ptBRShell,
    graph: ptBRGraph,
    branches: ptBRBranches,
    workingTree: ptBRWorkingTree,
    diff: ptBRDiff,
    conflicts: ptBRConflicts,
    rebase: ptBRRebase,
    palette: ptBRPalette,
    settings: ptBRSettings,
    menu: ptBRMenu,
    shortcuts: ptBRShortcuts,
    errors: ptBRErrors,
  },
  'zh-CN': {
    common: zhCNCommon,
    shell: zhCNShell,
    graph: zhCNGraph,
    branches: zhCNBranches,
    workingTree: zhCNWorkingTree,
    diff: zhCNDiff,
    conflicts: zhCNConflicts,
    rebase: zhCNRebase,
    palette: zhCNPalette,
    settings: zhCNSettings,
    menu: zhCNMenu,
    shortcuts: zhCNShortcuts,
    errors: zhCNErrors,
  },
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages,
  missingWarn: import.meta.env.DEV,
  fallbackWarn: false,
})

/**
 * Imperative translation for non-component code (stores, menus, toasts).
 * Components use the injected `$t` instead.
 */
export function translate(
  key: string,
  named?: Record<string, unknown>,
  locale?: AppLocale,
): string {
  return locale
    ? i18n.global.t(key, named ?? {}, { locale })
    : i18n.global.t(key, named ?? {})
}

function activate(locale: AppLocale): void {
  i18n.global.locale.value = locale
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}

// `applyLocale()` from `@/lib/locales` is what the store calls; this makes it
// actually swap messages and keep <html lang> in sync. Registration applies
// the current locale immediately.
registerLocaleApplier(activate)

/** Resolves the OS locale (Tauri) or the browser locale, with `en` fallback. */
export async function resolveSystemLocale(): Promise<AppLocale> {
  if (isTauri()) {
    try {
      const { locale } = await import('@tauri-apps/plugin-os')
      const resolved = normalizeLocale(await locale())
      if (resolved) return resolved
    } catch {
      /* fall through to navigator */
    }
  }
  return detectBrowserLocale() ?? DEFAULT_LOCALE
}
