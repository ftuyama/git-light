import { describe, expect, it } from 'vitest'
import { mockDiff } from './mockDiff'

function lines(diff: ReturnType<typeof mockDiff>) {
  return diff.hunks.flatMap((hunk) => hunk.lines)
}

describe('mockDiff', () => {
  it('returns deterministic hunks with matching stats', () => {
    const path = 'src/features/payment/authorize.ts'
    const diff = mockDiff(path)

    expect(diff).toEqual(mockDiff(path))
    expect(diff.binary).toBe(false)
    expect(diff.tooLarge).toBe(false)
    expect(diff.language).toBe('typescript')
    expect(diff.hunks).toHaveLength(3)
    expect(diff.additions).toBe(lines(diff).filter((line) => line.type === 'add').length)
    expect(diff.deletions).toBe(lines(diff).filter((line) => line.type === 'del').length)
  })

  it('turns every line into an addition or deletion for added/deleted files', () => {
    const added = mockDiff('src/features/payment/new.ts', 'added')
    expect(added.additions).toBeGreaterThan(0)
    expect(added.deletions).toBe(0)
    expect(lines(added).every((line) => line.type === 'add')).toBe(true)

    const deleted = mockDiff('src/features/payment/old.ts', 'deleted')
    expect(deleted.additions).toBe(0)
    expect(deleted.deletions).toBeGreaterThan(0)
    expect(lines(deleted).every((line) => line.type === 'del')).toBe(true)
  })

  it('maps extensions to languages and templates', () => {
    expect(mockDiff('App.vue').language).toBe('vue')
    expect(mockDiff('styles.css').language).toBe('css')
    expect(mockDiff('README.md').language).toBe('markdown')
    expect(mockDiff('data.json').language).toBe('json')
    expect(mockDiff('icon.svg').language).toBe('xml')
    expect(mockDiff('ci.yml').language).toBe('yaml')
    expect(mockDiff('unknown.bin').language).toBe('plaintext')

    expect(mockDiff('App.vue').hunks).toHaveLength(2)
    expect(mockDiff('styles.css').hunks).toHaveLength(2)
    expect(mockDiff('README.md').hunks).toHaveLength(1)
  })
})
