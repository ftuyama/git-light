import { resolveTheme, themeAppColor, type ThemePreference } from '@/lib/themes'
import { setWindowBackground } from '@/lib/tauri/appBridge'

let systemThemeUnwatch: (() => void) | null = null

export function applyTheme(preference: ThemePreference): void {
  const resolved = resolveTheme(preference)
  document.documentElement.dataset.theme = resolved
}

export function watchSystemTheme(onChange: () => void): () => void {
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

export function stopThemeWatcher(): void {
  systemThemeUnwatch?.()
  systemThemeUnwatch = null
}
