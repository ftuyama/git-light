import {
  customThemeCssVars,
  DEFAULT_CUSTOM_THEME,
  type CustomTheme,
} from '@/lib/customTheme'
import { resolveTheme, themeAppColor, type ThemePreference } from '@/lib/themes'
import { setWindowBackground } from '@/lib/tauri/appBridge'

let systemThemeUnwatch: (() => void) | null = null

function applyCustomTheme(theme: CustomTheme | undefined): void {
  const root = document.documentElement
  if (!theme) {
    for (const name of Object.keys(customThemeCssVars(DEFAULT_CUSTOM_THEME))) {
      root.style.removeProperty(name)
    }
    return
  }
  for (const [name, value] of Object.entries(customThemeCssVars(theme))) {
    root.style.setProperty(name, value)
  }
}

function applyTheme(preference: ThemePreference, custom?: CustomTheme): void {
  const resolved = resolveTheme(preference)
  applyCustomTheme(resolved === 'custom' ? (custom ?? DEFAULT_CUSTOM_THEME) : undefined)
  document.documentElement.dataset.theme = resolved
}

function watchSystemTheme(onChange: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

export function syncThemePreference(
  preference: ThemePreference,
  custom?: CustomTheme,
): void {
  systemThemeUnwatch?.()
  systemThemeUnwatch = null

  applyTheme(preference, custom)

  void setWindowBackground(themeAppColor(preference, custom))

  if (preference === 'system') {
    systemThemeUnwatch = watchSystemTheme(() => {
      applyTheme('system', custom)
      void setWindowBackground(themeAppColor('system', custom))
    })
  }
}
