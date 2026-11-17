import { DEFAULT_CUSTOM_THEME, type CustomTheme } from './customTheme'

const THEME_IDS = [
  'default',
  'dracula',
  'light',
  'claude',
  'tokyo-night',
  'nord',
  'gruvbox',
  'rose-pine',
  'one-dark',
  'solarized-light',
  'custom',
] as const
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
    id: 'nord',
    labelKey: 'settings.themes.nord.label',
    descriptionKey: 'settings.themes.nord.description',
    swatches: ['#2e3440', '#3b4252', '#88c0d0', '#eceff4'],
  },
  {
    id: 'gruvbox',
    labelKey: 'settings.themes.gruvbox.label',
    descriptionKey: 'settings.themes.gruvbox.description',
    swatches: ['#282828', '#3c3836', '#fabd2f', '#ebdbb2'],
  },
  {
    id: 'rose-pine',
    labelKey: 'settings.themes.rose-pine.label',
    descriptionKey: 'settings.themes.rose-pine.description',
    swatches: ['#191724', '#26233a', '#c4a7e7', '#e0def4'],
  },
  {
    id: 'one-dark',
    labelKey: 'settings.themes.one-dark.label',
    descriptionKey: 'settings.themes.one-dark.description',
    swatches: ['#282c34', '#2c313a', '#61afef', '#abb2bf'],
  },
  {
    id: 'solarized-light',
    labelKey: 'settings.themes.solarized-light.label',
    descriptionKey: 'settings.themes.solarized-light.description',
    swatches: ['#fdf6e3', '#eee8d5', '#268bd2', '#586e75'],
  },
  {
    id: 'custom',
    labelKey: 'settings.themes.custom.label',
    descriptionKey: 'settings.themes.custom.description',
    swatches: ['#12151a', '#1b2028', '#6e9fff', '#e6edf3'],
  },
  {
    id: 'system',
    labelKey: 'settings.themes.system.label',
    descriptionKey: 'settings.themes.system.description',
    swatches: ['#12151a', '#ffffff', '#6e9fff', '#0969da'],
  },
]

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value)
}

function prefersDarkColorScheme(): boolean {
  // No media-query support means we cannot detect a preference: stay light
  // rather than opting users into dark mode unasked.
  if (typeof globalThis.matchMedia !== 'function') {
    return false
  }
  return globalThis.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(preference: ThemePreference): ThemeId {
  if (preference === 'system') {
    return prefersDarkColorScheme() ? 'default' : 'light'
  }
  return preference
}

const THEME_APP_COLORS: Record<ThemeId, string> = {
  default: '#12151a',
  dracula: '#282a36',
  light: '#ffffff',
  claude: '#141413',
  'tokyo-night': '#1a1b26',
  nord: '#2e3440',
  gruvbox: '#282828',
  'rose-pine': '#191724',
  'one-dark': '#282c34',
  'solarized-light': '#fdf6e3',
  custom: DEFAULT_CUSTOM_THEME.app,
}

export function themeAppColor(preference: ThemePreference, custom?: CustomTheme): string {
  const resolved = resolveTheme(preference)
  if (resolved === 'custom') return custom?.app ?? DEFAULT_CUSTOM_THEME.app
  return THEME_APP_COLORS[resolved]
}
