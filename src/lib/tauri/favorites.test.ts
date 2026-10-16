import { describe, expect, it, vi } from 'vitest'
import { loadBranchFavorites, saveBranchFavorites } from './favorites'
import type { InvokeFn } from './invoke'

function invokerFor(map: Record<string, unknown>): InvokeFn {
  return vi.fn(async (cmd: string) => {
    if (!(cmd in map)) throw new Error(`unexpected command ${cmd}`)
    return map[cmd]
  })
}

describe('tauri favorites bridge', () => {
  it('loads favorites for a repo', async () => {
    const invoker = invokerFor({ git_get_favorites: ['main'] })
    await expect(loadBranchFavorites('/repo', invoker)).resolves.toEqual(['main'])
    expect(invoker).toHaveBeenCalledWith('git_get_favorites', { request: { repoPath: '/repo' } })
  })

  it('saves favorites for a repo', async () => {
    const invoker = invokerFor({ git_set_favorites: ['main', 'feat'] })
    await expect(saveBranchFavorites('/repo', ['main', 'feat'], invoker)).resolves.toEqual([
      'main',
      'feat',
    ])
    expect(invoker).toHaveBeenCalledWith('git_set_favorites', {
      request: { repoPath: '/repo', names: ['main', 'feat'] },
    })
  })
})
