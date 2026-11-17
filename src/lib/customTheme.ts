/**
 * User-defined theme colors.
 *
 * Only the base colors are stored; every other palette token (borders,
 * hover/elevated surfaces, muted text, lanes, syntax colors) is derived from
 * them in `assets/theme.css` via `color-mix()`, so the picker stays simple.
 */

export const CUSTOM_THEME_COLOR_KEYS = [
  'app',
  'panel',
  'fg',
  'accent',
  'success',
  'warning',
  'danger',
] as const

export type CustomThemeColorKey = (typeof CUSTOM_THEME_COLOR_KEYS)[number]

export type CustomTheme = Record<CustomThemeColorKey, string>

/** Catalog keys (`settings.customTheme.*`); translated at render time. */
export const CUSTOM_THEME_COLOR_LABEL_KEYS: Record<CustomThemeColorKey, string> = {
  app: 'settings.customTheme.app',
  panel: 'settings.customTheme.panel',
  fg: 'settings.customTheme.fg',
  accent: 'settings.customTheme.accent',
  success: 'settings.customTheme.success',
  warning: 'settings.customTheme.warning',
  danger: 'settings.customTheme.danger',
}

/** Mirrors the `default` palette so the custom theme starts on familiar colors. */
export const DEFAULT_CUSTOM_THEME: CustomTheme = {
  app: '#12151a',
  panel: '#1b2028',
  fg: '#e6edf3',
  accent: '#6e9fff',
  success: '#3fb950',
  warning: '#f0883e',
  danger: '#f85149',
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value)
}

export function sanitizeCustomTheme(value: unknown): CustomTheme {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const theme = { ...DEFAULT_CUSTOM_THEME }
  for (const key of CUSTOM_THEME_COLOR_KEYS) {
    const candidate = source[key]
    if (isHexColor(candidate)) theme[key] = candidate.toLowerCase()
  }
  return theme
}

/** CSS variables consumed by the `[data-theme='custom']` block in theme.css. */
export function customThemeCssVars(theme: CustomTheme): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const key of CUSTOM_THEME_COLOR_KEYS) {
    vars[`--custom-${key}`] = theme[key]
  }
  return vars
}
