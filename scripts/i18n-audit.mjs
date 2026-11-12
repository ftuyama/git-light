#!/usr/bin/env node
/**
 * i18n migration guard.
 *
 * Counts user-visible English literals still hardcoded in Vue templates so the
 * migration can only ever move in one direction. The number is compared with
 * `scripts/i18n-baseline.json`; CI (or `npm run i18n:audit`) fails when a
 * change adds new literals instead of translating them.
 *
 * Usage:
 *   node scripts/i18n-audit.mjs            # compare against the baseline
 *   node scripts/i18n-audit.mjs --update   # rewrite the baseline (after a migration)
 *   node scripts/i18n-audit.mjs --verbose  # list every match
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const BASELINE = join(ROOT, 'scripts', 'i18n-baseline.json')

const TEXT_ATTRIBUTES = ['title', 'placeholder', 'aria-label', 'alt', 'label', 'confirm-text']

const SCRIPT_RE = /<script[\s\S]*?<\/script>/gi
const STYLE_RE = /<style[\s\S]*?<\/style>/gi
const COMMENT_RE = /<!--[\s\S]*?-->/g
const TEXT_NODE_RE = />([^<>]*)</g
const ATTRIBUTE_RES = TEXT_ATTRIBUTES.map(
  (attribute) => new RegExp(`(?<![\\w:@-])${attribute}="([^"]*)"`, 'g'),
)

/** Anything that is not user-facing prose: bindings, code, paths, symbols. */
function isSuspicious(text) {
  const value = text.trim()
  if (!value) return false
  if (value.length < 2) return false
  if (/[{}]/.test(value)) return false
  if (/^[#.:/@[\]()=*+<>|&%$"'`,;]+$/.test(value)) return false
  if (!/\p{L}/u.test(value)) return false
  // Single short tokens are usually CSS classes, ids or enum values.
  if (!/\s/.test(value) && value.length < 4) return false
  return true
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(path)))
    else if (entry.name.endsWith('.vue')) files.push(path)
  }
  return files
}

function scanTemplate(source) {
  const template = source
    .replace(SCRIPT_RE, '')
    .replace(STYLE_RE, '')
    .replace(COMMENT_RE, '')
  const matches = []

  for (const match of template.matchAll(TEXT_NODE_RE)) {
    const text = match[1] ?? ''
    if (isSuspicious(text)) matches.push(text.trim())
  }
  for (const regex of ATTRIBUTE_RES) {
    for (const match of template.matchAll(regex)) {
      const text = match[1] ?? ''
      if (isSuspicious(text)) matches.push(text.trim())
    }
  }
  return matches
}

/**
 * Script blocks hold user-facing strings too (toasts, prompt copy). Only the
 * explicit UI call sites are counted, to avoid flagging keys and CSS classes.
 */
function scanScript(source) {
  const script = /<script[\s\S]*?<\/script>/i.exec(source)?.[0] ?? ''
  const matches = []
  for (const match of script.matchAll(/toast\.push\(\s*(['"`])([^'"`$\n]{4,})\1/g)) {
    if (isSuspicious(match[2] ?? '')) matches.push(match[2].trim())
  }
  return matches
}

function scanFile(source) {
  return [...scanTemplate(source), ...scanScript(source)]
}

const verbose = process.argv.includes('--verbose')
const update = process.argv.includes('--update')

const files = await walk(SRC)
const counts = {}
let total = 0

for (const file of files.sort()) {
  const matches = scanFile(await readFile(file, 'utf8'))
  if (matches.length === 0) continue
  counts[relative(ROOT, file)] = matches.length
  total += matches.length
  if (verbose) {
    console.log(`${relative(ROOT, file)} (${matches.length})`)
    for (const text of matches) console.log(`  · ${text}`)
  }
}

if (update) {
  const payload = { generatedAt: new Date().toISOString(), total, files: counts }
  await writeFile(BASELINE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`i18n baseline written: ${total} literal(s) in ${Object.keys(counts).length} file(s)`)
  process.exit(0)
}

let baseline = null
try {
  baseline = JSON.parse(await readFile(BASELINE, 'utf8'))
} catch {
  console.log(`i18n audit: ${total} hardcoded literal(s) — no baseline yet, run with --update`)
  process.exit(0)
}

const regressions = Object.entries(counts)
  .map(([file, count]) => ({ file, delta: count - (baseline.files?.[file] ?? 0) }))
  .filter((entry) => entry.delta > 0)

if (total > baseline.total) {
  console.error(
    `i18n audit failed: ${total} hardcoded literal(s), baseline is ${baseline.total} (+${total - baseline.total})`,
  )
  for (const { file, delta } of regressions) console.error(`  +${delta} ${file}`)
  console.error('Translate them with $t()/translate(), or run --update if the growth is intentional.')
  process.exit(1)
}

const progress = baseline.total - total
console.log(
  `i18n audit ok: ${total} hardcoded literal(s)` +
    (progress > 0 ? ` — ${progress} migrated since the baseline` : ''),
)
