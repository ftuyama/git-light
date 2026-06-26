import { describe, expect, it } from 'vitest'
import { APP_LINKS, formatAboutCredits, THIRD_PARTY_CREDITS } from './credits'
import { APP_DESCRIPTION, APP_LICENSE, APP_MAKER } from './metadata'

describe('formatAboutCredits', () => {
  it('includes app description, attribution, links, and third-party credits', () => {
    const text = formatAboutCredits()

    expect(text).toContain(APP_DESCRIPTION)
    expect(text).toContain(`Built by ${APP_MAKER}`)
    expect(text).toContain(`${APP_LICENSE} License`)

    for (const link of APP_LINKS) {
      expect(text).toContain(`${link.label}: ${link.url}`)
    }

    for (const credit of THIRD_PARTY_CREDITS) {
      expect(text).toContain(`${credit.name} (${credit.license})`)
    }
  })
})
