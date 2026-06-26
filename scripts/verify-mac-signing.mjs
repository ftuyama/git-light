#!/usr/bin/env node
/**
 * Fail CI when the packaged .app is missing a valid code signature.
 */
import { execSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dist = join(process.cwd(), 'dist')

function findAppBundle() {
  for (const name of ['mac-arm64', 'mac']) {
    const app = join(dist, name, 'Git Light.app')
    if (existsSync(app)) return app
  }

  if (!existsSync(dist)) return null

  for (const entry of readdirSync(dist, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const app = join(dist, entry.name, 'Git Light.app')
    if (existsSync(app)) return app
  }

  return null
}

const app = findAppBundle()
if (!app) {
  console.error('verify-mac-signing: Git Light.app not found under dist/')
  process.exit(1)
}

const signatureDir = join(app, 'Contents', '_CodeSignature')
if (!existsSync(signatureDir)) {
  console.error(`verify-mac-signing: missing ${signatureDir}`)
  process.exit(1)
}

execSync(`codesign --verify --deep --strict --verbose=2 "${app}"`, {
  stdio: 'inherit',
})

console.log(`verify-mac-signing: OK (${app})`)
