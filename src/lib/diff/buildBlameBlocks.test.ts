import { describe, expect, it } from 'vitest'
import type { WireBlameLine } from '@shared/git/models'
import { blockForLineIndex, buildBlameBlocks, isBlockStart } from './buildBlameBlocks'

function line(
  index: number,
  sha: string,
  overrides: Partial<WireBlameLine> = {},
): WireBlameLine {
  return {
    lineNumber: index + 1,
    commitSha: sha,
    shortSha: sha.slice(0, 7),
    author: `Author-${sha.slice(0, 4)}`,
    authorEmail: '',
    authorTime: 1700000000 + index,
    content: `line ${index + 1}`,
    ...overrides,
  }
}

describe('buildBlameBlocks', () => {
  it('returns empty array for no lines', () => {
    expect(buildBlameBlocks([])).toEqual([])
  })

  it('groups consecutive lines with the same commit', () => {
    const lines = [
      line(0, 'aaa1111'),
      line(1, 'aaa1111'),
      line(2, 'bbb2222'),
      line(3, 'bbb2222'),
      line(4, 'bbb2222'),
    ]

    const blocks = buildBlameBlocks(lines)
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({
      commitSha: 'aaa1111',
      startLineIndex: 0,
      lineCount: 2,
      colorIndex: 0,
    })
    expect(blocks[1]).toMatchObject({
      commitSha: 'bbb2222',
      startLineIndex: 2,
      lineCount: 3,
      colorIndex: 1,
    })
  })

  it('reuses color index when the same commit appears in a later block', () => {
    const lines = [line(0, 'aaa1111'), line(1, 'bbb2222'), line(2, 'aaa1111')]
    const blocks = buildBlameBlocks(lines)

    expect(blocks).toHaveLength(3)
    expect(blocks[0]!.colorIndex).toBe(0)
    expect(blocks[1]!.colorIndex).toBe(1)
    expect(blocks[2]!.colorIndex).toBe(0)
  })

  it('carries summary from the first line of a block', () => {
    const lines = [
      line(0, 'aaa1111', { summary: 'Initial commit' }),
      line(1, 'aaa1111'),
    ]
    expect(buildBlameBlocks(lines)[0]?.summary).toBe('Initial commit')
  })
})

describe('blockForLineIndex', () => {
  const blocks = buildBlameBlocks([
    line(0, 'aaa1111'),
    line(1, 'aaa1111'),
    line(2, 'bbb2222'),
  ])

  it('finds the block containing a line index', () => {
    expect(blockForLineIndex(blocks, 0)?.commitSha).toBe('aaa1111')
    expect(blockForLineIndex(blocks, 1)?.commitSha).toBe('aaa1111')
    expect(blockForLineIndex(blocks, 2)?.commitSha).toBe('bbb2222')
  })

  it('returns undefined for out-of-range indices', () => {
    expect(blockForLineIndex(blocks, -1)).toBeUndefined()
    expect(blockForLineIndex(blocks, 99)).toBeUndefined()
  })
})

describe('isBlockStart', () => {
  it('identifies the first line of a block', () => {
    const blocks = buildBlameBlocks([line(0, 'aaa1111'), line(1, 'aaa1111'), line(2, 'bbb2222')])
    expect(isBlockStart(blocks[0]!, 0)).toBe(true)
    expect(isBlockStart(blocks[0]!, 1)).toBe(false)
    expect(isBlockStart(blocks[1]!, 2)).toBe(true)
  })
})
