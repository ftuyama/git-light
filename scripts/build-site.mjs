#!/usr/bin/env node
/**
 * Build the localized landing page.
 *
 * Source of truth: `site/index.html` (template) + `site/locales/<code>.json`.
 * Output: `docs/index.html` (default locale), `docs/<code>/index.html` and
 * `docs/sitemap.xml`. Never edit the generated files by hand.
 *
 * Usage:
 *   npm run site:build            # render every locale
 *   npm run site:build -- --check # fail when the output is stale or a catalog
 *                                 # is missing keys / has empty values
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const siteDir = join(root, 'site')
const docsDir = join(root, 'docs')
const checkOnly = process.argv.includes('--check')

const config = JSON.parse(readFileSync(join(siteDir, 'site.config.json'), 'utf8'))
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const template = readFileSync(join(siteDir, 'index.html'), 'utf8')

const templateVersion = (
  readFileSync(join(siteDir, 'index.html'), 'utf8').match(/\{\{version\}\}/g) ?? []
).length
if (templateVersion === 0) {
  console.warn('site/index.html has no {{version}} placeholder')
}

const defaultLocale = config.defaultLocale
const baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`
const basePath = new URL(baseUrl).pathname

/** @typedef {{ code: string, label: string, htmlLang: string, ogLocale: string, dir?: string }} LocaleConfig */

/** @type {LocaleConfig[]} */
const locales = config.locales

if (!locales.some((locale) => locale.code === defaultLocale)) {
  fail(`site.config.json: defaultLocale "${defaultLocale}" is not listed in locales`)
}

const errors = []

function fail(message) {
  errors.push(message)
}

/** Deep-merge-free flatten: arrays and primitives stay leaves. */
function flatten(value, prefix = '', out = {}) {
  if (Array.isArray(value)) {
    out[prefix] = value
    return out
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out)
    }
    return out
  }
  out[prefix] = value
  return out
}

function assertSameShape(reference, other, path, locale) {
  if (Array.isArray(reference)) {
    if (!Array.isArray(other)) {
      fail(`${locale}: "${path}" must be an array`)
      return
    }
    if (other.length !== reference.length) {
      fail(`${locale}: "${path}" has ${other.length} item(s), expected ${reference.length}`)
      return
    }
    reference.forEach((item, index) => assertSameShape(item, other[index], `${path}[${index}]`, locale))
    return
  }
  if (reference && typeof reference === 'object') {
    if (!other || typeof other !== 'object' || Array.isArray(other)) {
      fail(`${locale}: "${path}" must be an object`)
      return
    }
    for (const key of Object.keys(reference)) {
      if (!(key in other)) fail(`${locale}: missing key "${path}.${key}"`)
      else assertSameShape(reference[key], other[key], `${path}.${key}`, locale)
    }
    for (const key of Object.keys(other)) {
      if (!(key in reference)) fail(`${locale}: unknown key "${path}.${key}"`)
    }
    return
  }
  if (typeof other !== 'string') {
    fail(`${locale}: "${path}" must be a string`)
    return
  }
  if (!other.trim()) fail(`${locale}: "${path}" is empty`)
}

/** @type {Map<string, Record<string, unknown>>} */
const catalogs = new Map()
const englishCatalog = JSON.parse(readFileSync(join(siteDir, 'locales', 'en.json'), 'utf8'))

for (const locale of locales) {
  const path = join(siteDir, 'locales', `${locale.code}.json`)
  if (!existsSync(path)) {
    fail(`missing catalog: site/locales/${locale.code}.json`)
    continue
  }
  const catalog = JSON.parse(readFileSync(path, 'utf8'))
  assertSameShape(englishCatalog, catalog, '', locale.code)
  catalogs.set(locale.code, flatten(catalog))
}

if (errors.length > 0) {
  printErrors()
  process.exit(1)
}

function printErrors() {
  console.error('Site build failed:')
  for (const error of errors) console.error(`  - ${error}`)
}

const escapeHtml = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function pageUrlFor(locale) {
  return locale === defaultLocale ? baseUrl : `${baseUrl}${locale}/`
}

function resolveToken(catalog, type, key) {
  if (type === 'j' && key === 'seo.faqJsonLd') {
    return JSON.stringify(
      catalog['seo.faq'].map((item) => ({
        '@type': 'Question',
        name: stripTags(item.q),
        acceptedAnswer: { '@type': 'Answer', text: stripTags(item.a) },
      })),
      null,
      2,
    )
  }

  const value = catalog[key]
  if (value === undefined) {
    fail(`template references missing key "${key}"`)
    return ''
  }
  if (typeof value !== 'string') {
    if (type !== 'j') {
      fail(`key "${key}" is not a string and cannot be used with {{${type}:...}}`)
      return ''
    }
    return JSON.stringify(value)
  }
  if (type === 'a') return escapeHtml(value)
  if (type === 'j') return JSON.stringify(value)
  return value
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function renderFaqItems(catalog) {
  return catalog['seo.faq']
    .map(
      (item) => `            <article class="faq-item">
              <h3>${escapeHtml(item.q)}</h3>
              <p>${item.a}</p>
            </article>`,
    )
    .join('\n')
}

function renderCompareRows(catalog) {
  return catalog['compare.rows']
    .map(
      (row) => `                <tr>
                  <th scope="row">${escapeHtml(row.label)}</th>
                  <td class="yes">✅</td>
                  <td>${escapeHtml(row.gitkraken)}</td>
                  <td>${escapeHtml(row.githubDesktop)}</td>
                  <td>${escapeHtml(row.sourcetree)}</td>
                </tr>`,
    )
    .join('\n')
}

function renderLangOptions(locale) {
  const prefix = locale.code === defaultLocale ? './' : '../'
  return locales
    .map((entry) => {
      const href = entry.code === defaultLocale ? prefix : `${prefix}${entry.code}/`
      const selected = entry.code === locale.code ? ' selected' : ''
      return `            <option value="${href}"${selected}>${escapeHtml(entry.label)}</option>`
    })
    .join('\n')
}

function renderHreflang() {
  const lines = locales.map(
    (entry) =>
      `    <link rel="alternate" hreflang="${entry.htmlLang}" href="${pageUrlFor(entry.code)}" />`,
  )
  lines.push(`    <link rel="alternate" hreflang="x-default" href="${pageUrlFor(defaultLocale)}" />`)
  return lines.join('\n')
}

function renderOgAlternates(locale) {
  return locales
    .filter((entry) => entry.code !== locale.code)
    .map((entry) => `    <meta property="og:locale:alternate" content="${entry.ogLocale}" />`)
    .join('\n')
}

function renderHintBanner(catalog) {
  return `      <div id="lang-hint" class="lang-hint" hidden>
        <span id="lang-hint-text"></span>
        <a id="lang-hint-link" href="#"></a>
        <button
          id="lang-hint-close"
          class="lang-hint-close"
          type="button"
          aria-label="${escapeHtml(catalog['hint.close'])}"
        >
          ×
        </button>
      </div>`
}

function renderI18nData() {
  const data = {
    defaultLocale,
    locales: {},
  }
  for (const entry of locales) {
    if (entry.code === defaultLocale) continue
    const catalog = catalogs.get(entry.code)
    data.locales[entry.code] = {
      label: entry.label,
      htmlLang: entry.htmlLang,
      href: pageUrlFor(entry.code),
      hint: catalog['hint.message'],
      view: catalog['hint.view'],
    }
  }
  return `    <script>window.SITE_I18N = ${JSON.stringify(data, null, 2)};</script>`
}

function renderPage(locale) {
  const catalog = catalogs.get(locale.code)
  let html = template

  html = html
    .replaceAll('{{j:lang}}', JSON.stringify(locale.htmlLang))
    .replaceAll('{{j:version}}', JSON.stringify(packageJson.version))

  html = html.replace(/\{\{([a-z]):([A-Za-z0-9_.]+)\}\}/g, (_match, type, key) =>
    resolveToken(catalog, type, key),
  )

  html = html
    .replaceAll('{{version}}', packageJson.version)
    .replaceAll('{{lang}}', locale.htmlLang)
    .replaceAll('{{dir}}', locale.dir ?? 'ltr')
    .replaceAll('{{baseUrl}}', baseUrl)
    .replaceAll('{{basePath}}', locale.code === defaultLocale ? './' : '../')
    .replaceAll('{{pageUrl}}', pageUrlFor(locale.code))
    .replaceAll('{{ogLocale}}', locale.ogLocale)

  const replacements = [
    ['<!-- site:hreflang -->', renderHreflang()],
    ['<!-- site:og-alternates -->', renderOgAlternates(locale)],
    ['<!-- site:lang-options -->', renderLangOptions(locale)],
    ['<!-- site:compare-rows -->', renderCompareRows(catalog)],
    ['<!-- site:faq-items -->', renderFaqItems(catalog)],
    ['<!-- site:hint -->', locale.code === defaultLocale ? renderHintBanner(catalog) : ''],
    ['<!-- site:i18n-data -->', renderI18nData()],
  ]
  for (const [marker, replacement] of replacements) {
    if (!html.includes(marker)) fail(`site/index.html is missing the ${marker} placeholder`)
    html = html.replace(marker, replacement)
  }

  const leftoverToken = html.match(/\{\{[a-z]?:?[A-Za-z0-9_.]*\}\}/)
  if (leftoverToken) fail(`site/index.html left an unresolved token: ${leftoverToken[0]}`)
  const leftoverMarker = html.match(/<!-- site:[a-z-]+ -->/)
  if (leftoverMarker) fail(`site/index.html left an unresolved placeholder: ${leftoverMarker[0]}`)

  return `${html.trimEnd()}\n`
}

function outputPath(locale) {
  return locale.code === defaultLocale
    ? join(docsDir, 'index.html')
    : join(docsDir, locale.code, 'index.html')
}

function renderSitemap() {
  const alternates = locales
    .map(
      (entry) =>
        `    <xhtml:link rel="alternate" hreflang="${entry.htmlLang}" href="${pageUrlFor(entry.code)}" />`,
    )
    .join('\n')
  const urls = locales
    .map(
      (entry) => `  <url>
    <loc>${pageUrlFor(entry.code)}</loc>
    <lastmod>${config.lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${entry.code === defaultLocale ? '1.0' : '0.9'}</priority>
${alternates}
  </url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
>
${urls}
  <url>
    <loc>${baseUrl}llms.txt</loc>
    <lastmod>${config.lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}llms-full.txt</loc>
    <lastmod>${config.lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
`
}

if (errors.length > 0) {
  printErrors()
  process.exit(1)
}

/** @type {{ path: string, contents: string }[]} */
const outputs = []
for (const locale of locales) {
  outputs.push({ path: outputPath(locale), contents: renderPage(locale) })
}
outputs.push({ path: join(docsDir, 'sitemap.xml'), contents: renderSitemap() })

if (errors.length > 0) {
  printErrors()
  process.exit(1)
}

let stale = 0
for (const output of outputs) {
  const current = existsSync(output.path) ? readFileSync(output.path, 'utf8') : null
  if (current === output.contents) continue
  stale += 1
  if (checkOnly) {
    const relative = output.path.slice(root.length + 1)
    console.error(`stale: ${relative} (run \`npm run site:build\`)`)
    continue
  }
  mkdirSync(dirname(output.path), { recursive: true })
  writeFileSync(output.path, output.contents)
  console.log(`wrote ${output.path.slice(root.length + 1)}`)
}

if (checkOnly) {
  if (stale > 0) {
    console.error(`site build is stale: ${stale} file(s) need regenerating`)
    process.exit(1)
  }
  console.log(`site build ok (${locales.length} locales)`)
  process.exit(0)
}

console.log(`site built: ${locales.length} locales → docs/`)
