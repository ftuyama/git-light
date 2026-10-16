import { describe, expect, it, vi } from 'vitest'
import {
  tauriCloneRepo,
  tauriDiscoverRepos,
  tauriGitVersion,
  tauriInitRepo,
  tauriOpenRepo,
  tauriPing,
  tauriRecentRepos,
} from './commands'
import type { InvokeFn } from './invoke'

function fakeInvoker(
  impl: (cmd: string, args?: Record<string, unknown>) => unknown,
): InvokeFn {
  return vi.fn(async (cmd: string, args?: Record<string, unknown>) => impl(cmd, args))
}

describe('tauri commands', () => {
  it('pings the Rust backend', async () => {
    const invoker = fakeInvoker(async () => 'pong')
    await expect(tauriPing('pong', invoker)).resolves.toBe('pong')
    expect(invoker).toHaveBeenCalledWith('ping', { value: 'pong' })
  })

  it('reads the git version', async () => {
    const invoker = fakeInvoker(async () => ({ version: 'git version 2.49.0' }))
    await expect(tauriGitVersion(invoker)).resolves.toBe('git version 2.49.0')
    expect(invoker).toHaveBeenCalledWith('git_version', undefined)
  })

  it('lists recent repos', async () => {
    const repos = [{ path: '/repo', name: 'repo', lastOpened: 1 }]
    const invoker = fakeInvoker(async () => repos)
    await expect(tauriRecentRepos(invoker)).resolves.toEqual(repos)
    expect(invoker).toHaveBeenCalledWith('git_recent_repos', undefined)
  })

  it('opens a repo with path and options', async () => {
    const result = { ok: true }
    const invoker = fakeInvoker(async () => result)
    await expect(
      tauriOpenRepo({ path: '/repo', options: { commitLimit: 50 } }, invoker),
    ).resolves.toEqual(result)
    expect(invoker).toHaveBeenCalledWith('git_open_repo', {
      path: '/repo',
      options: { commitLimit: 50 },
    })
  })

  it('clones a repo with url, parent and options', async () => {
    const result = { ok: true }
    const invoker = fakeInvoker(async () => result)
    const request = { url: 'https://github.com/org/repo.git', parentPath: '/tmp/parent' }
    await expect(
      tauriCloneRepo({ request, options: { commitLimit: 50 } }, invoker),
    ).resolves.toEqual(result)
    expect(invoker).toHaveBeenCalledWith('git_clone_repo', {
      request,
      options: { commitLimit: 50 },
    })
  })

  it('inits a repo with path and branch', async () => {
    const result = { ok: true }
    const invoker = fakeInvoker(async () => result)
    const request = { path: '/tmp/new-repo', defaultBranch: 'main' }
    await expect(tauriInitRepo({ request }, invoker)).resolves.toEqual(result)
    expect(invoker).toHaveBeenCalledWith('git_init_repo', { request, options: undefined })
  })

  it('discovers repos under a root', async () => {
    const found = [{ path: '/tmp/parent/a', name: 'a' }]
    const invoker = fakeInvoker(async () => found)
    await expect(tauriDiscoverRepos({ root: '/tmp/parent' }, invoker)).resolves.toEqual(found)
    expect(invoker).toHaveBeenCalledWith('git_discover_repos', {
      request: { root: '/tmp/parent' },
    })
  })
})
