import { resolveTheme, themeAppColor, type ThemePreference } from '@/lib/themes'
import { setWindowBackground } from '@/lib/tauri/appBridge'

let systemThemeUnwatch: (() => void) | null = null

function applyTheme(preference: ThemePreference): void {
  const resolved = resolveTheme(preference)
  document.documentElement.dataset.theme = resolved
}

function watchSystemTheme(onChange: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

export function syncThemePreference(preference: ThemePreference): void {
  systemThemeUnwatch?.()
  systemThemeUnwatch = null

  applyTheme(preference)

  void setWindowBackground(themeAppColor(preference))

  if (preference === 'system') {
    systemThemeUnwatch = watchSystemTheme(() => {
      applyTheme('system')
      void setWindowBackground(themeAppColor('system'))
    })
  }
}
