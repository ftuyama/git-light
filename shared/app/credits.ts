import {
  APP_AUTHOR_URL,
  APP_DESCRIPTION,
  APP_HOMEPAGE,
  APP_LICENSE,
  APP_MAKER,
  APP_REPOSITORY,
  APP_SPONSOR_URL,
} from './metadata'

export interface ThirdPartyCredit {
  name: string
  url: string
  license: string
}

export type AppLinkId = 'website' | 'github' | 'kofi'

export const APP_LINKS: { id: AppLinkId; label: string; url: string }[] = [
  { id: 'website', label: 'Website', url: APP_HOMEPAGE },
  { id: 'github', label: 'Source code', url: APP_REPOSITORY },
  { id: 'kofi', label: 'Sponsor on Ko-fi', url: APP_SPONSOR_URL },
]

export const THIRD_PARTY_CREDITS: ThirdPartyCredit[] = [
  { name: 'Vue', url: 'https://vuejs.org/', license: 'MIT' },
  { name: 'Electron', url: 'https://www.electronjs.org/', license: 'MIT' },
  { name: 'Pinia', url: 'https://pinia.vuejs.org/', license: 'MIT' },
  { name: 'Tailwind CSS', url: 'https://tailwindcss.com/', license: 'MIT' },
  { name: 'Lucide', url: 'https://lucide.dev/', license: 'ISC' },
  { name: 'highlight.js', url: 'https://highlightjs.org/', license: 'BSD-3-Clause' },
  { name: 'date-fns', url: 'https://date-fns.org/', license: 'MIT' },
  { name: 'TanStack Virtual', url: 'https://tanstack.com/virtual', license: 'MIT' },
  { name: 'splitpanes', url: 'https://antoniandre.github.io/splitpanes/', license: 'MIT' },
  { name: 'Reka UI', url: 'https://reka-ui.com/', license: 'MIT' },
]

/** Plain-text credits for the native About panel (macOS / Windows / Linux). */
export function formatAboutCredits(): string {
  const lines = [
    APP_DESCRIPTION,
    '',
    `Built by ${APP_MAKER} (${APP_AUTHOR_URL})`,
    `${APP_LICENSE} License`,
    '',
    ...APP_LINKS.map((link) => `${link.label}: ${link.url}`),
    '',
    'Open source:',
    ...THIRD_PARTY_CREDITS.map((credit) => `${credit.name} (${credit.license})`),
  ]

  return lines.join('\n')
}
