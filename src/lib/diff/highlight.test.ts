import { describe, expect, it } from 'vitest'
import { highlightLine } from './highlight'

describe('highlightLine', () => {
  it('highlights Ruby code', () => {
    const result = highlightLine('def hello', 'ruby')
    expect(result).toContain('hljs-keyword')
    expect(result).toContain('def')
  })

  it('highlights JavaScript code', () => {
    const result = highlightLine('const x = 1', 'javascript')
    expect(result).toContain('hljs-keyword')
    expect(result).toContain('const')
  })

  it('highlights TypeScript code', () => {
    const result = highlightLine('interface User { name: string }', 'typescript')
    expect(result).toContain('hljs-keyword')
    expect(result).toContain('interface')
  })

  it('resolves language aliases', () => {
    expect(highlightLine('class Foo', 'rb')).toContain('hljs-keyword')
    expect(highlightLine('let x = 1', 'js')).toContain('hljs-keyword')
    expect(highlightLine('type T = string', 'ts')).toContain('hljs-keyword')
  })

  it('escapes plaintext for unknown languages', () => {
    const result = highlightLine('a < b && c > d', 'plaintext')
    expect(result).toBe('a &lt; b &amp;&amp; c &gt; d')
    expect(result).not.toContain('hljs-')
  })

  it('returns empty string for empty content', () => {
    expect(highlightLine('', 'ruby')).toBe('')
  })
})
