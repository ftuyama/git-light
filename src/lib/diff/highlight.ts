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
  if (contents.length === 0) return []

  const lang = resolveHighlightLanguage(language)
  if (lang === 'plaintext' || !hljs.getLanguage(lang)) {
    return contents.map(escapeHtml)
  }

  try {
    const highlighted = hljs.highlight(contents.join('\n'), {
      language: lang,
      ignoreIllegals: true,
    }).value
    const parts = highlighted.split('\n')
    if (parts.length === contents.length) return parts
  } catch {
    // fall through to per-line highlighting
  }

  return contents.map((line) => highlightLine(line, language))
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
