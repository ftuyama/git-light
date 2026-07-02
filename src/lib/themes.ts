export const THEME_IDS = ['default', 'dracula', 'light', 'claude'] as const
export type ThemeId = (typeof THEME_IDS)[number]

export const THEME_PREFERENCES = [...THEME_IDS, 'system'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]

export interface ThemeDefinition {
  id: ThemePreference
  label: string
  description: string
  swatches: string[]
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Dark palette with blue accents.',
    swatches: ['#12151a', '#1b2028', '#6e9fff', '#e6edf3'],
  },
  {
    id: 'dracula',
    label: 'Dracula',
    description: 'Classic Dracula theme with purple and pink accents.',
    swatches: ['#282a36', '#44475a', '#bd93f9', '#f8f8f2'],
  },
  {
    id: 'light',
    label: 'Light',
    description: 'Clean light palette inspired by GitHub and VS Code.',
    swatches: ['#ffffff', '#f6f8fa', '#0969da', '#1f2328'],
  },
  {
    id: 'claude',
    label: 'Claude',
    description: 'Dark warm charcoal palette inspired by claude.ai.',
    swatches: ['#141413', '#252320', '#d97757', '#faf9f5'],
  },
  {
    id: 'system',
    label: 'System',
    description: 'Matches your operating system appearance.',
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
}

export function themeAppColor(preference: ThemePreference): string {
  return THEME_APP_COLORS[resolveTheme(preference)]
}
