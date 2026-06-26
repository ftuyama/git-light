#!/usr/bin/env node
/**
 * Rebrand the bundled Electron.app Info.plist for local development on macOS.
 *
 * Menu bar, Dock, and Cmd+Tab labels come from CFBundleName at launch time;
 * app.setName() cannot override them when running the stock Electron binary.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'darwin') {
  process.exit(0)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const appName = packageJson.productName ?? packageJson.name

const plistPath = join(
  root,
  'node_modules/electron/dist/Electron.app/Contents/Info.plist',
)

if (!existsSync(plistPath)) {
  console.warn('brand-electron: Electron.app Info.plist not found, skipping')
  process.exit(0)
}

/** @param {string} content @param {string} key @param {string} value */
function setPlistString(content, key, value) {
  const pattern = new RegExp(`(<key>${key}</key>\\s*<string>)[^<]*(</string>)`, 'm')
  return content.replace(pattern, `$1${value}$2`)
}

const before = readFileSync(plistPath, 'utf8')
let after = setPlistString(before, 'CFBundleDisplayName', appName)
after = setPlistString(after, 'CFBundleName', appName)

if (after === before) {
  console.log(`brand-electron: already branded as "${appName}"`)
  process.exit(0)
}

writeFileSync(plistPath, after)
console.log(`brand-electron: branded Electron.app as "${appName}"`)
