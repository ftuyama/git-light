#!/usr/bin/env node
/**
 * Print packaged app size breakdown after `npm run dist:mac`.
 */
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const dist = join(root, 'dist')

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function du(path) {
  try {
    return sh(`du -sh "${path}"`)
  } catch {
    return null
  }
}

function findAppBundle() {
  for (const name of ['mac-arm64', 'mac']) {
    const app = join(dist, name, 'Git Light.app')
    if (existsSync(app)) return app
  }
  const entries = existsSync(dist) ? readdirSync(dist) : []
  for (const entry of entries) {
    const app = join(dist, entry, 'Git Light.app')
    if (existsSync(app)) return app
  }
  return null
}

console.log('Git Light — dist size analysis\n')

const dmgs = existsSync(dist)
  ? readdirSync(dist).filter((f) => f.endsWith('.dmg'))
  : []
if (dmgs.length === 0) {
  console.error('No DMG found. Run: npm run dist:mac')
  process.exit(1)
}

for (const dmg of dmgs) {
  console.log(`DMG: ${du(join(dist, dmg))}  (${dmg})`)
}

const app = findAppBundle()
if (!app) {
  console.error('\nNo .app bundle found under dist/')
  process.exit(1)
}

console.log(`App: ${du(app)}`)

const asar = join(app, 'Contents/Resources/app.asar')
if (existsSync(asar)) {
  console.log(`ASAR: ${du(asar)}`)
  try {
    const listing = sh(`npx --yes asar list "${asar}"`)
    const hasNodeModules = listing.split('\n').some((line) => line.startsWith('/node_modules'))
    const topLevel = [...new Set(listing.split('\n').map((l) => l.split('/')[1]).filter(Boolean))]
    console.log(`ASAR top-level: ${topLevel.join(', ')}`)
    console.log(`ASAR includes node_modules: ${hasNodeModules ? 'yes' : 'no'}`)
  } catch {
    console.log('(asar list skipped)')
  }
}

const localeDir = join(
  app,
  'Contents/Frameworks/Electron Framework.framework/Versions/A/Resources',
)
if (existsSync(localeDir)) {
  const locales = readdirSync(localeDir).filter((f) => f.endsWith('.lproj'))
  console.log(`Electron locales: ${locales.length}`)
}

const rendererAssets = join(root, 'out/renderer/assets')
if (existsSync(rendererAssets)) {
  console.log('\nRenderer assets (from npm run build):')
  for (const file of readdirSync(rendererAssets)) {
    const { size } = statSync(join(rendererAssets, file))
    const kb = (size / 1024).toFixed(1)
    console.log(`  ${kb} KB  ${file}`)
  }
}
