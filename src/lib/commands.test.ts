import { describe, expect, it } from 'vitest'
import { filterCommands, fuzzyScore, type PaletteCommand } from './commands'

function command(title: string, keywords?: string): PaletteCommand {
  return { id: title, title, keywords, run: () => {} }
}

describe('fuzzyScore', () => {
  it('matches exact and prefix queries', () => {
    expect(fuzzyScore('push', 'Push')).not.toBeNull()
    expect(fuzzyScore('pus', 'Push')).not.toBeNull()
  })

  it('matches out-of-order characters as a subsequence', () => {
    expect(fuzzyScore('psh', 'Push')).not.toBeNull()
    expect(fuzzyScore('fal', 'Fetch All')).not.toBeNull()
  })

  it('returns null when characters are missing', () => {
    expect(fuzzyScore('pushx', 'Push')).toBeNull()
    expect(fuzzyScore('z', 'Push')).toBeNull()
  })

  it('prefers contiguous and earlier matches', () => {
    const contiguous = fuzzyScore('push', 'Push')!
    const scattered = fuzzyScore('push', 'Pop stash (push)')!
    expect(contiguous).toBeLessThan(scattered)
  })
})

describe('filterCommands', () => {
  const all = [
    command('Fetch'),
    command('Push', 'upload remote'),
    command('Checkout main', 'branch switch'),
    command('Stash Changes'),
  ]

  it('returns everything on empty query', () => {
    expect(filterCommands(all, '')).toHaveLength(4)
    expect(filterCommands(all, '   ')).toHaveLength(4)
  })

  it('matches titles case-insensitively', () => {
    expect(filterCommands(all, 'push').map((c) => c.title)).toContain('Push')
  })

  it('matches keywords', () => {
    expect(filterCommands(all, 'upload').map((c) => c.title)).toEqual(['Push'])
    expect(filterCommands(all, 'branch').map((c) => c.title)).toEqual(['Checkout main'])
  })

  it('drops non-matching commands', () => {
    expect(filterCommands(all, 'zzz')).toHaveLength(0)
  })
})
