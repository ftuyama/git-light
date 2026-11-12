export const THEME_IDS = ['default', 'dracula', 'light', 'claude', 'tokyo-night'] as const
export type ThemeId = (typeof THEME_IDS)[number]

export const THEME_PREFERENCES = [...THEME_IDS, 'system'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]

export interface ThemeDefinition {
  id: ThemePreference
  /** Catalog keys in `settings.themes.*`; translated at render time. */
  labelKey: string
  descriptionKey: string
  swatches: string[]
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'default',
    labelKey: 'settings.themes.default.label',
    descriptionKey: 'settings.themes.default.description',
    swatches: ['#12151a', '#1b2028', '#6e9fff', '#e6edf3'],
  },
  {
    id: 'dracula',
    labelKey: 'settings.themes.dracula.label',
    descriptionKey: 'settings.themes.dracula.description',
    swatches: ['#282a36', '#44475a', '#bd93f9', '#f8f8f2'],
  },
  {
    id: 'light',
    labelKey: 'settings.themes.light.label',
    descriptionKey: 'settings.themes.light.description',
    swatches: ['#ffffff', '#f6f8fa', '#0969da', '#1f2328'],
  },
  {
    id: 'claude',
    labelKey: 'settings.themes.claude.label',
    descriptionKey: 'settings.themes.claude.description',
    swatches: ['#141413', '#252320', '#d97757', '#faf9f5'],
  },
  {
    id: 'tokyo-night',
    labelKey: 'settings.themes.tokyo-night.label',
    descriptionKey: 'settings.themes.tokyo-night.description',
    swatches: ['#1a1b26', '#24283b', '#7aa2f7', '#c0caf5'],
  },
  {
    id: 'system',
    labelKey: 'settings.themes.system.label',
    descriptionKey: 'settings.themes.system.description',
    swatches: ['#12151a', '#ffffff', '#6e9fff', '#0969da'],
  },
]

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value)
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value)
}

export function prefersDarkColorScheme(): boolean {
  if (typeof globalThis.matchMedia !== 'function') {
    return true
  }
  return globalThis.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(preference: ThemePreference): ThemeId {
  if (preference === 'system') {
    return prefersDarkColorScheme() ? 'default' : 'light'
  }
  return preference
}

export const THEME_APP_COLORS: Record<ThemeId, string> = {
  default: '#12151a',
  dracula: '#282a36',
  light: '#ffffff',
  claude: '#141413',
  'tokyo-night': '#1a1b26',
}

export function themeAppColor(preference: ThemePreference): string {
  return THEME_APP_COLORS[resolveTheme(preference)]
}
