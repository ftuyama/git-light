import { resolveTheme, themeAppColor, type ThemePreference } from '@/lib/themes'

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

  if (window.electron?.setWindowBackgroundColor) {
    void window.electron.setWindowBackgroundColor(themeAppColor(preference))
  }

  if (preference === 'system') {
    systemThemeUnwatch = watchSystemTheme(() => {
      applyTheme('system')
      if (window.electron?.setWindowBackgroundColor) {
        void window.electron.setWindowBackgroundColor(themeAppColor('system'))
      }
    })
  }
}

export function stopThemeWatcher(): void {
  systemThemeUnwatch?.()
  systemThemeUnwatch = null
}
