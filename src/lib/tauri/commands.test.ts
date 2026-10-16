import { describe, expect, it, vi } from 'vitest'
import { tauriGitVersion, tauriOpenRepo, tauriPing, tauriRecentRepos } from './commands'
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
})
