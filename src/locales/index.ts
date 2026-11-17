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

import deBranches from './de/branches.json'
import deCommon from './de/common.json'
import deConflicts from './de/conflicts.json'
import deDiff from './de/diff.json'
import deErrors from './de/errors.json'
import deGraph from './de/graph.json'
import deMenu from './de/menu.json'
import dePalette from './de/palette.json'
import deRebase from './de/rebase.json'
import deSettings from './de/settings.json'
import deShell from './de/shell.json'
import deShortcuts from './de/shortcuts.json'
import deWorkingTree from './de/workingTree.json'

import esBranches from './es/branches.json'
import esCommon from './es/common.json'
import esConflicts from './es/conflicts.json'
import esDiff from './es/diff.json'
import esErrors from './es/errors.json'
import esGraph from './es/graph.json'
import esMenu from './es/menu.json'
import esPalette from './es/palette.json'
import esRebase from './es/rebase.json'
import esSettings from './es/settings.json'
import esShell from './es/shell.json'
import esShortcuts from './es/shortcuts.json'
import esWorkingTree from './es/workingTree.json'

import frBranches from './fr/branches.json'
import frCommon from './fr/common.json'
import frConflicts from './fr/conflicts.json'
import frDiff from './fr/diff.json'
import frErrors from './fr/errors.json'
import frGraph from './fr/graph.json'
import frMenu from './fr/menu.json'
import frPalette from './fr/palette.json'
import frRebase from './fr/rebase.json'
import frSettings from './fr/settings.json'
import frShell from './fr/shell.json'
import frShortcuts from './fr/shortcuts.json'
import frWorkingTree from './fr/workingTree.json'

import jaBranches from './ja/branches.json'
import jaCommon from './ja/common.json'
import jaConflicts from './ja/conflicts.json'
import jaDiff from './ja/diff.json'
import jaErrors from './ja/errors.json'
import jaGraph from './ja/graph.json'
import jaMenu from './ja/menu.json'
import jaPalette from './ja/palette.json'
import jaRebase from './ja/rebase.json'
import jaSettings from './ja/settings.json'
import jaShell from './ja/shell.json'
import jaShortcuts from './ja/shortcuts.json'
import jaWorkingTree from './ja/workingTree.json'

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
  de: {
    common: deCommon,
    shell: deShell,
    graph: deGraph,
    branches: deBranches,
    workingTree: deWorkingTree,
    diff: deDiff,
    conflicts: deConflicts,
    rebase: deRebase,
    palette: dePalette,
    settings: deSettings,
    menu: deMenu,
    shortcuts: deShortcuts,
    errors: deErrors,
  },
  es: {
    common: esCommon,
    shell: esShell,
    graph: esGraph,
    branches: esBranches,
    workingTree: esWorkingTree,
    diff: esDiff,
    conflicts: esConflicts,
    rebase: esRebase,
    palette: esPalette,
    settings: esSettings,
    menu: esMenu,
    shortcuts: esShortcuts,
    errors: esErrors,
  },
  fr: {
    common: frCommon,
    shell: frShell,
    graph: frGraph,
    branches: frBranches,
    workingTree: frWorkingTree,
    diff: frDiff,
    conflicts: frConflicts,
    rebase: frRebase,
    palette: frPalette,
    settings: frSettings,
    menu: frMenu,
    shortcuts: frShortcuts,
    errors: frErrors,
  },
  ja: {
    common: jaCommon,
    shell: jaShell,
    graph: jaGraph,
    branches: jaBranches,
    workingTree: jaWorkingTree,
    diff: jaDiff,
    conflicts: jaConflicts,
    rebase: jaRebase,
    palette: jaPalette,
    settings: jaSettings,
    menu: jaMenu,
    shortcuts: jaShortcuts,
    errors: jaErrors,
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
