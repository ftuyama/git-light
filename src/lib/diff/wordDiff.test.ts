import { describe, expect, it } from 'vitest'
import { diffWords, renderInlineDiff, shouldInlineHighlight } from './wordDiff'

describe('diffWords', () => {
  it('marks only the changed value', () => {
    const { oldSegments, newSegments } = diffWords('const foo = 1', 'const foo = 2')
    expect(oldSegments.filter((s) => s.changed).map((s) => s.text).join('')).toBe('1')
    expect(newSegments.filter((s) => s.changed).map((s) => s.text).join('')).toBe('2')
    expect(oldSegments.filter((s) => !s.changed).map((s) => s.text).join('')).toContain(
      'const foo =',
    )
  })

  it('returns unchanged segments for identical lines', () => {
    const { oldSegments, newSegments } = diffWords('same', 'same')
    expect(oldSegments.every((s) => !s.changed)).toBe(true)
    expect(newSegments.every((s) => !s.changed)).toBe(true)
  })

  it('marks whole side changed when one side is empty', () => {
    const { newSegments } = diffWords('', 'new line')
    expect(newSegments).toHaveLength(1)
    expect(newSegments[0].changed).toBe(true)
  })

  it('refines single-token replacement to char level', () => {
    const { oldSegments } = diffWords('foo1', 'foo2')
    const changed = oldSegments.filter((s) => s.changed).map((s) => s.text).join('')
    expect(changed).toBe('1')
    expect(oldSegments.map((s) => s.text).join('')).toBe('foo1')
  })
})

describe('shouldInlineHighlight', () => {
  it('rejects identical or empty pairs', () => {
    expect(shouldInlineHighlight('a', 'a')).toBe(false)
    expect(shouldInlineHighlight('', 'a')).toBe(false)
    expect(shouldInlineHighlight('a', '')).toBe(false)
  })

  it('accepts real change pairs', () => {
    expect(shouldInlineHighlight('const foo = 1', 'const foo = 2')).toBe(true)
  })
})

describe('renderInlineDiff', () => {
  it('wraps only changed words and escapes html', () => {
    const { oldHtml, newHtml } = renderInlineDiff('const foo = 1', 'const foo = 2', 'plaintext')
    expect(newHtml).toContain('diff-word-add')
    expect(oldHtml).toContain('diff-word-del')
    // Unchanged part is present without a word wrapper around the whole line.
    expect(newHtml).toContain('const foo =')
    expect(newHtml).not.toMatch(/^<span class="diff-word-add">.*<\/span>$/)
  })

  it('escapes markup in changed segments', () => {
    const { newHtml } = renderInlineDiff('a', 'a < b', 'plaintext')
    expect(newHtml).toContain('&lt;')
    expect(newHtml).not.toContain('< b')
  })

  it('keeps syntax highlighting inside unchanged code', () => {
    const { newHtml } = renderInlineDiff('const foo = 1', 'const foo = 2', 'javascript')
    expect(newHtml).toContain('hljs-keyword')
    expect(newHtml).toContain('diff-word-add')
  })
})
