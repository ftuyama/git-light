import { describe, expect, it } from 'vitest'
import { dateFnsLocale, fullTimestamp, relativeTime } from './format'

const NOW = new Date('2026-11-12T15:00:00Z')
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000)

describe('dateFnsLocale', () => {
  it('resolves a date-fns locale for every shipped app locale', () => {
    expect(dateFnsLocale('en').code).toBe('en-US')
    expect(dateFnsLocale('pt-BR').code).toBe('pt-BR')
    expect(dateFnsLocale('zh-CN').code).toBe('zh-CN')
  })
})

describe('fullTimestamp', () => {
  it('formats in the requested locale', () => {
    expect(fullTimestamp(NOW, 'en')).toMatch(/2026/)
    expect(fullTimestamp(NOW, 'pt-BR')).toMatch(/2026/)
    expect(fullTimestamp(NOW, 'zh-CN')).toContain('2026')
  })
})

describe('relativeTime', () => {
  it('uses the requested locale wording', () => {
    const earlier = hoursAgo(3)
    expect(relativeTime(earlier, 'en')).toMatch(/ago/)
    expect(relativeTime(earlier, 'pt-BR')).toMatch(/há/)
    expect(relativeTime(earlier, 'zh-CN')).toContain('前')
  })

  it('accepts a numeric timestamp like the old date-fns calls did', () => {
    expect(relativeTime(Date.now() - 60 * 1000, 'en')).toMatch(/ago/)
  })
})
