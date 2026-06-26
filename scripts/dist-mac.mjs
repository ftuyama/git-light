#!/usr/bin/env node
/**
 * Package Git Light for macOS with the best signing available:
 * - Developer ID + notarization when Apple CI secrets are set
 * - Ad-hoc bundle signing otherwise (avoids Gatekeeper "damaged app" errors)
 */
import { spawnSync } from 'node:child_process'

if (process.env.APPLE_CERTIFICATE_BASE64 && !process.env.CSC_LINK) {
  process.env.CSC_LINK = process.env.APPLE_CERTIFICATE_BASE64
}

const hasSigningCert = Boolean(process.env.CSC_LINK)
const canNotarize =
  hasSigningCert &&
  Boolean(process.env.APPLE_ID) &&
  Boolean(process.env.APPLE_APP_SPECIFIC_PASSWORD) &&
  Boolean(process.env.APPLE_TEAM_ID)

const builderArgs = ['electron-builder', '--mac', 'dmg', '--publish', 'never']

if (canNotarize) {
  console.log('macOS build: Developer ID signing + notarization')
  builderArgs.push('--config.mac.notarize=true', '--config.mac.hardenedRuntime=true')
} else if (hasSigningCert) {
  console.log(
    'macOS build: Developer ID signing (notarization skipped — set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID)',
  )
  builderArgs.push('--config.mac.hardenedRuntime=true')
} else {
  console.log(
    'macOS build: ad-hoc signing (configure GitHub Apple secrets for notarized releases)',
  )
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
  builderArgs.push(
    '--config.mac.identity=-',
    '--config.mac.hardenedRuntime=false',
    '--config.mac.notarize=false',
  )
}

const result = spawnSync('npx', builderArgs, {
  stdio: 'inherit',
  env: process.env,
  shell: true,
})

process.exit(result.status ?? 1)
