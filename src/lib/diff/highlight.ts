import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

const registered = new Set<string>()

function registerLanguage(name: string, mod: { default?: unknown } | unknown): void {
  if (registered.has(name)) return
  const language = (mod as { default?: unknown }).default ?? mod
  hljs.registerLanguage(name, language as Parameters<typeof hljs.registerLanguage>[1])
  registered.add(name)
}

registerLanguage('bash', bash)
registerLanguage('css', css)
registerLanguage('go', go)
registerLanguage('java', java)
registerLanguage('javascript', javascript)
registerLanguage('json', json)
registerLanguage('markdown', markdown)
registerLanguage('python', python)
registerLanguage('ruby', ruby)
registerLanguage('rust', rust)
registerLanguage('sql', sql)
registerLanguage('typescript', typescript)
registerLanguage('xml', xml)
registerLanguage('yaml', yaml)
registerLanguage('html', xml)
registerLanguage('vue', xml)

const aliasMap: Record<string, string> = {
  plaintext: 'plaintext',
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  md: 'markdown',
  yml: 'yaml',
  sh: 'bash',
  shell: 'bash',
  rb: 'ruby',
  vue: 'xml',
}

export function resolveHighlightLanguage(language: string): string {
  return aliasMap[language] ?? language
}

export function highlightLine(content: string, language: string): string {
  if (!content) return ''
  const lang = resolveHighlightLanguage(language)
  if (lang === 'plaintext' || !hljs.getLanguage(lang)) {
    return escapeHtml(content)
  }
  try {
    return hljs.highlight(content, { language: lang, ignoreIllegals: true }).value
  } catch {
    return escapeHtml(content)
  }
}

/** Highlight an entire blame buffer, then split back into per-line HTML. */
export function highlightBlameLines(contents: string[], language: string): string[] {
  return highlightHunkLines(contents, language)
}

/**
 * Highlight a hunk's lines joined together, then split back into per-line HTML.
 * Joining preserves multi-line tokens (block comments, template strings) and
 * lets highlight.js apply embedded sub-languages (e.g. Vue SFC `<script>` JS
 * and `<style>` CSS inside the `xml` grammar). Per-line highlighting loses
 * both, which is why added/removed lines looked flat green/red.
 */
export function highlightHunkLines(contents: string[], language: string): string[] {
  if (contents.length === 0) return []

  const lang = resolveHighlightLanguage(language)
  if (lang === 'plaintext' || !hljs.getLanguage(lang)) {
    return contents.map(escapeHtml)
  }

  if (language === 'vue' || lang === 'vue') {
    return highlightVueLines(contents)
  }

  return highlightJoined(contents, lang, language)
}

function highlightJoined(contents: string[], lang: string, originalLanguage: string): string[] {
  const parts = tryJoined(contents, lang)
  if (parts) return parts

  return contents.map((line) => highlightLine(line, originalLanguage))
}

function tryJoined(contents: string[], lang: string): string[] | null {
  if (!hljs.getLanguage(lang)) return null
  try {
    const highlighted = hljs.highlight(contents.join('\n'), {
      language: lang,
      ignoreIllegals: true,
    }).value
    return splitBalanced(highlighted, contents.length)
  } catch {
    return null
  }
}

/**
 * Split joined highlight HTML back into per-line fragments. Highlight.js
 * emits spans that can cross `\n` (block comments, embedded Vue sub-language
 * wrappers), which would leave unclosed tags when each line renders in its
 * own `<code>` element — so close open spans at each line end and reopen
 * them on the next line.
 */
function splitBalanced(highlighted: string, expectedLines: number): string[] | null {
  const raw = highlighted.split('\n')
  if (raw.length !== expectedLines) return null

  const tagPattern = /<span[^>]*>|<\/span>/g
  let open: string[] = []
  return raw.map((line, index) => {
    let out = open.join('')
    tagPattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = tagPattern.exec(line)) !== null) {
      if (match[0].startsWith('</')) {
        open.pop()
      } else {
        open.push(match[0])
      }
    }
    out += line
    if (index < raw.length - 1) {
      out += '</span>'.repeat(open.length)
    }
    return out
  })
}

function hasSpans(parts: string[]): boolean {
  return parts.some((part) => part.includes('hljs-'))
}

const VUE_BLOCK_MARKER = /<\/?(template|script|style)[\s>/]/i
const HTML_TAG = /<\/?[a-z][^>]*>/i
const VUE_INTERPOLATION = /\{\{.*\}\}/
const CSS_LINE = /^\s*([.#@:a-z-][^{};]*\{|@media|@import|@keyframes)/i
const CSS_DECLARATION = /^\s*[a-z-]+\s*:\s*[^;]+;\s*$/i
// Script signals must win over the CSS heuristics: `if (...) {` and arrow
// callbacks like `() => {` match CSS_LINE but are far more likely to be
// `<script>` code in a marker-less hunk. (?<!@) keeps CSS `@import` out.
const SCRIPT_SIGNAL = /(?<!@)\b(const|let|var|function|import|export|return|interface|type|enum|extends|if|for|while|=>)\b/

/**
 * Vue SFC hunks need block-aware highlighting. A hunk spanning `<script>` /
 * `<style>` markers highlights correctly as joined `xml` (highlight.js embeds
 * JS/CSS sub-languages). But a hunk fully inside `<script>` has no markers,
 * so joined `xml` yields zero spans — fall back to TypeScript (superset of
 * the JS usually found there) or CSS for style-only hunks.
 */
function highlightVueLines(contents: string[]): string[] {
  if (contents.some((line) => VUE_BLOCK_MARKER.test(line))) {
    return highlightJoined(contents, 'xml', 'vue')
  }

  const xmlParts = tryJoined(contents, 'xml')
  if (xmlParts && hasSpans(xmlParts)) return xmlParts

  const looksTemplate = contents.some(
    (line) => HTML_TAG.test(line) || VUE_INTERPOLATION.test(line),
  )
  if (looksTemplate && xmlParts) return xmlParts

  // Script first: control flow and declarations (`if (…) {`, `() => {`)
  // also match the CSS brace heuristics but are overwhelmingly `<script>`
  // code in a marker-less SFC hunk.
  const looksScript = contents.some((line) => SCRIPT_SIGNAL.test(line))
  if (looksScript) {
    const tsParts = tryJoined(contents, 'typescript')
    if (tsParts && hasSpans(tsParts)) return tsParts
  }

  const looksCss =
    !looksTemplate &&
    contents.some((line) => CSS_LINE.test(line) || CSS_DECLARATION.test(line))
  if (looksCss) {
    const cssParts = tryJoined(contents, 'css')
    if (cssParts && hasSpans(cssParts)) return cssParts
  }

  const tsParts = tryJoined(contents, 'typescript')
  if (tsParts && hasSpans(tsParts)) return tsParts

  if (xmlParts) return xmlParts
  return contents.map((line) => highlightLine(line, 'vue'))
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
