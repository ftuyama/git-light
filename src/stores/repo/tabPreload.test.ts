import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { RepositoryData } from '@/types/git'

const fakeBackend = vi.hoisted(() => ({
  activateCalls: [] as string[],
}))

vi.mock('@/lib/git', () => ({
  gitService: {
    get commitPage() {
      return { oldestSha: null, hasMore: false, total: null }
    },
    openRepository: async (path: string) => ({
      ok: true,
      data: {
        repository: {
          name: path.split('/').pop() ?? path,
          path,
          gitVersion: '2.0',
          currentBranch: 'main',
          ahead: 0,
          behind: 0,
          remoteUrl: '',
        },
        commits: [],
        branches: [],
        tags: [],
        stashes: [],
        worktrees: [],
        workingTree: [],
        authors: [],
        commitAuthor: null,
        page: { oldestSha: null, hasMore: false, total: null },
      } as unknown as RepositoryData,
      message: 'Opened',
    }),
    activateRepository: async (path: string) => {
      fakeBackend.activateCalls.push(path)
      return { ok: true, path, message: '' }
    },
  },
}))

import { preloadSavedTabs } from './tabPreload'
import { useRepositoryStore } from '@/stores/repository'
import { useRepoTabsStore } from '@/stores/repoTabs'

describe('preloadSavedTabs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fakeBackend.activateCalls = []
  })

  it('re-aligns the backend with the visible repository after preloading', async () => {
    const repo = useRepositoryStore()
    repo.repository = { name: 'visible', path: '/visible' } as unknown as RepositoryData['repository']
    const tabs = useRepoTabsStore()
    tabs.addTab('/visible', 'visible')
    tabs.addTab('/other', 'other')

    await preloadSavedTabs(repo, tabs.tabs, '/visible')

    // Every preload `git_open_repo` re-points the backend's single open repo;
    // the visible repo must be restored when the loop ends or later watcher
    // events / auto-fetch / diffs would run against the last preloaded tab.
    expect(fakeBackend.activateCalls).toContain('/visible')
    expect(repo.repository?.path).toBe('/visible')
  })
})
