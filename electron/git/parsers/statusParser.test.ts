import { describe, expect, it } from 'vitest'
import { parseNumstat, parseStatus } from './statusParser'

describe('parseNumstat', () => {
  it('parses simple numstat lines', () => {
    const map = parseNumstat('3\t1\tsrc/a.ts\0')
    expect(map.get('src/a.ts')).toEqual({ additions: 3, deletions: 1 })
  })
})

describe('parseStatus', () => {
  it('parses porcelain v2 modified file', () => {
    const files = parseStatus({
      porcelain: '1 .M N... 100644 100644 100644 abc def src/file.ts\0',
      staged: new Map(),
      unstaged: new Map([['src/file.ts', { additions: 2, deletions: 1 }]]),
    })
    expect(files).toHaveLength(1)
    expect(files[0].path).toBe('src/file.ts')
    expect(files[0].status).toBe('modified')
    expect(files[0].staged).toBe(false)
    expect(files[0].additions).toBe(2)
    expect(files[0].deletions).toBe(1)
  })

  it('splits staged and unstaged rows for the same path', () => {
    const files = parseStatus({
      porcelain: '1 MM N... 100644 100644 100644 a b src/file.ts\0',
      staged: new Map([['src/file.ts', { additions: 1, deletions: 0 }]]),
      unstaged: new Map([['src/file.ts', { additions: 0, deletions: 2 }]]),
    })
    const staged = files.filter((f) => f.staged)
    const unstaged = files.filter((f) => !f.staged)
    expect(staged).toHaveLength(1)
    expect(unstaged).toHaveLength(1)
  })
})
