#!/usr/bin/env node
/**
 * Sync version markers from package.json (source of truth).
 *
 * Release workflow: .cursor/commands/release.md (Phase 3)
 *
 * Targets:
 * - package-lock.json — top-level "version" and packages[""].version
 * - docs/index.html — vX.Y.Z markers (hero badge and footer)
 *
 * The app reads package.json at build time (shared/app/metadata.ts); no sync needed there.
 *
 * Usage:
 *   npm run sync-version           # sync all targets
 *   npm run sync-version -- --check  # verify only; exit 1 if out of sync
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')

const packageJsonPath = join(root, 'package.json')
const packageLockPath = join(root, 'package-lock.json')
const docsPath = join(root, 'docs/index.html')

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
const version = packageJson.version

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid semver in package.json: ${version}`)
  process.exit(1)
}

/** @type {string[]} */
const mismatches = []

/**
 * @param {string} label
 * @param {string} actual
 */
function expectVersion(label, actual) {
  if (actual !== version) {
    mismatches.push(`${label}: expected ${version}, found ${actual}`)
  }
}

/**
 * @param {string} label
 * @param {string} path
 * @param {() => void} sync
 */
function syncTarget(label, path, sync) {
  if (checkOnly) {
    return
  }

  const before = readFileSync(path, 'utf8')
  sync()
  const after = readFileSync(path, 'utf8')

  if (after === before) {
    console.log(`${label} already at v${version}`)
  } else {
    console.log(`Updated ${label} to v${version}`)
  }
}

// package-lock.json
const packageLock = JSON.parse(readFileSync(packageLockPath, 'utf8'))
expectVersion('package-lock.json (top-level)', packageLock.version)
expectVersion('package-lock.json (packages[""])', packageLock.packages?.['']?.version ?? '(missing)')

syncTarget('package-lock.json', packageLockPath, () => {
  packageLock.version = version
  if (packageLock.packages?.['']) {
    packageLock.packages[''].version = version
  }
  writeFileSync(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`)
})

// docs/index.html
const docs = readFileSync(docsPath, 'utf8')
const markerPattern = /v\d+\.\d+\.\d+/g
const markers = docs.match(markerPattern) ?? []

if (markers.length === 0) {
  console.warn('No vX.Y.Z markers found in docs/index.html')
} else {
  const uniqueMarkers = [...new Set(markers)]
  for (const marker of uniqueMarkers) {
    const actual = marker.slice(1)
    if (actual !== version) {
      mismatches.push(`docs/index.html (${marker}): expected v${version}`)
    }
  }

  syncTarget('docs/index.html', docsPath, () => {
    writeFileSync(docsPath, docs.replace(markerPattern, `v${version}`))
  })
}

if (checkOnly) {
  if (mismatches.length > 0) {
    console.error('Version mismatch (run `npm run sync-version` to fix):')
    for (const line of mismatches) {
      console.error(`  - ${line}`)
    }
    process.exit(1)
  }

  console.log(`All version markers match v${version}`)
  process.exit(0)
}

if (mismatches.length > 0) {
  console.log(`Synced from package.json v${version}`)
} else {
  console.log(`Version v${version} already in sync (app reads package.json at build time)`)
}
