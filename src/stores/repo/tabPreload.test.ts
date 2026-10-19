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
      data: repoData(path),
      message: 'Opened',
    }),
    activateRepository: async (path: string) => {
      fakeBackend.activateCalls.push(path)
      return { ok: true, path, message: '' }
    },
  },
}))

function repoData(path: string): RepositoryData {
  return {
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
  } as unknown as RepositoryData
}

import { gitService } from '@/lib/git'
import { preloadSavedTabs, preloadTabInBackground } from './tabPreload'
import { useRepositoryStore } from '@/stores/repository'
import { useRepoTabsStore } from '@/stores/repoTabs'
import { useRepoTabCacheStore } from '@/stores/repoTabCache'

type PreloadCapable = {
  preloadRepository?: (
    path: string,
    options?: unknown,
  ) => Promise<{ ok: boolean; data?: RepositoryData; page?: unknown; message: string }>
}

describe('preloadSavedTabs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fakeBackend.activateCalls = []
    delete (gitService as PreloadCapable).preloadRepository
  })

  it('re-aligns the backend with the visible repository when preloading re-points it', async () => {
    const repo = useRepositoryStore()
    repo.repository = { name: 'visible', path: '/visible' } as unknown as RepositoryData['repository']
    const tabs = useRepoTabsStore()
    tabs.addTab('/visible', 'visible')
    tabs.addTab('/other', 'other')

    await preloadSavedTabs(repo, tabs.tabs, '/visible')

    // Without `preloadRepository`, every preload `git_open_repo` re-points the
    // backend's single open repo; the visible repo must be restored when the
    // loop ends or later watcher events / auto-fetch / diffs would run against
    // the last preloaded tab.
    expect(fakeBackend.activateCalls).toContain('/visible')
    expect(repo.repository?.path).toBe('/visible')
  })

  it('prefers preloadRepository, which never re-points the backend', async () => {
    const preloaded: string[] = []
    ;(gitService as PreloadCapable).preloadRepository = async (path: string) => {
      preloaded.push(path)
      return {
        ok: true,
        data: repoData(path),
        page: { oldestSha: `sha:${path}`, hasMore: true, total: null },
        message: '',
      }
    }
    const repo = useRepositoryStore()
    repo.repository = { name: 'visible', path: '/visible' } as unknown as RepositoryData['repository']
    const tabs = useRepoTabsStore()
    tabs.addTab('/visible', 'visible')
    tabs.addTab('/other', 'other')

    await preloadSavedTabs(repo, tabs.tabs, '/visible')

    expect(preloaded).toEqual(['/other'])
    // No re-point happened, so nothing needs re-aligning.
    expect(fakeBackend.activateCalls).toEqual([])
    // The cached entry carries the page of the preloaded tab, not the shared
    // `commitPage` of the visible one.
    const cached = useRepoTabCacheStore().get('/other')
    expect(cached?.commitPage.oldestSha).toBe('sha:/other')
  })

  it('skips already-cached tabs and duplicate in-flight preloads', async () => {
    let calls = 0
    ;(gitService as PreloadCapable).preloadRepository = async (path: string) => {
      calls += 1
      await new Promise((resolve) => setTimeout(resolve, 0))
      return { ok: true, data: repoData(path), page: undefined, message: '' }
    }
    const repo = useRepositoryStore()
    repo.repository = { name: 'visible', path: '/visible' } as unknown as RepositoryData['repository']
    const tabs = useRepoTabsStore()
    tabs.addTab('/visible', 'visible')
    tabs.addTab('/other', 'other')

    await Promise.all([
      preloadTabInBackground('/other'),
      preloadTabInBackground('/other'),
      preloadSavedTabs(repo, tabs.tabs, '/visible'),
    ])

    expect(calls).toBe(1)
    expect(fakeBackend.activateCalls).toEqual([])
  })
})
