#!/usr/bin/env node
// Worktree helper: keeps every parallel checkout under `worktrees/` at the repo root.
//
//   npm run wt:add -- <name> [--base <ref>] [--install]
//   npm run wt:ls
//   npm run wt:rm  -- <name> [--force] [--delete-branch]
//   npm run wt:prune

import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync } from 'node:fs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORKTREES_DIR = join(ROOT, 'worktrees')
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

const USAGE = `Usage:
  npm run wt:add  -- <name> [--base <ref>] [--install]   create branch + worktrees/<name>
  npm run wt:ls                                          list worktrees
  npm run wt:rm   -- <name> [--force] [--delete-branch]  remove worktrees/<name>
  npm run wt:prune                                       drop stale worktree metadata

Worktrees live in worktrees/ (gitignored); each one gets its own npm install and
Rust build directory.`

function git(args, options = {}) {
  return spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', ...options })
}

function run(args, cwd) {
  const result = spawnSync(args[0], args.slice(1), { cwd, stdio: 'inherit' })
  if (result.status !== 0) {
    fail(`command failed: ${args.join(' ')}`)
  }
}

function fail(message) {
  console.error(`error: ${message}`)
  process.exit(1)
}

function branchExists(name) {
  return git(['show-ref', '--verify', '--quiet', `refs/heads/${name}`]).status === 0
}

function worktreePath(name) {
  return join(WORKTREES_DIR, name)
}

function parse(argv) {
  const positional = []
  const flags = new Map()

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      positional.push(arg)
      continue
    }
    const [flag, inline] = arg.split('=', 2)
    if (flag === '--base') {
      flags.set('base', inline ?? argv[++i])
      if (!flags.get('base')) fail('--base needs a ref')
      continue
    }
    if (flag === '--install' || flag === '--force' || flag === '--delete-branch') {
      flags.set(flag.slice(2), true)
      continue
    }
    fail(`unknown flag: ${arg}`)
  }

  return { positional, flags: flags }
}

function add({ positional, flags }) {
  const name = positional[0]
  if (!name) fail('missing worktree name')
  if (!NAME_RE.test(name)) fail(`invalid worktree name: ${name} (use letters, digits, dot, dash, underscore)`)

  const base = flags.get('base') ?? 'HEAD'
  const dest = worktreePath(name)
  if (existsSync(dest)) fail(`worktrees/${name} already exists`)

  mkdirSync(WORKTREES_DIR, { recursive: true })

  const reuse = branchExists(name)
  const args = reuse
    ? ['worktree', 'add', dest, name]
    : ['worktree', 'add', '-b', name, dest, base]

  const result = git(args)
  if (result.status !== 0) fail(result.stderr.trim() || `git ${args.join(' ')} failed`)

  if (flags.get('install')) {
    console.log(`\nInstalling dependencies in worktrees/${name}…`)
    run(['npm', 'install'], dest)
  }

  console.log(`\nCreated worktrees/${name} on branch ${name}${reuse ? ' (existing branch)' : ` from ${base}`}`)
  console.log('\nNext steps:')
  console.log(`  cd worktrees/${name}`)
  if (!flags.get('install')) console.log('  npm install')
  console.log('  npm run dev        # only one Tauri dev window at a time (:1420)')
}

function list() {
  const result = git(['worktree', 'list'])
  if (result.status !== 0) fail(result.stderr.trim())
  process.stdout.write(result.stdout)
}

function remove({ positional, flags }) {
  const name = positional[0]
  if (!name) fail('missing worktree name')

  const dest = worktreePath(name)
  const args = ['worktree', 'remove', dest]
  if (flags.get('force')) args.push('--force')

  const result = git(args)
  if (result.status !== 0) fail(result.stderr.trim() || `git ${args.join(' ')} failed`)

  git(['worktree', 'prune'])

  if (flags.get('delete-branch') && branchExists(name)) {
    const deleted = git(['branch', '-d', name])
    if (deleted.status !== 0) {
      console.warn(`warning: kept branch ${name} (${deleted.stderr.trim().split('\n').pop()})`)
    }
  }

  console.log(`Removed worktrees/${name}`)
  if (!flags.get('delete-branch')) console.log(`Branch ${name} kept; delete with: npm run wt:rm -- ${name} --delete-branch`)
}

function prune() {
  const result = git(['worktree', 'prune', '-v'])
  if (result.status !== 0) fail(result.stderr.trim())
  process.stdout.write(result.stdout || 'Nothing to prune\n')
}

const [command, ...rest] = process.argv.slice(2)
const parsed = parse(rest)

switch (command) {
  case 'add':
    add(parsed)
    break
  case 'list':
    list()
    break
  case 'remove':
    remove(parsed)
    break
  case 'prune':
    prune()
    break
  default:
    console.log(USAGE)
    if (command) process.exitCode = 1
}
