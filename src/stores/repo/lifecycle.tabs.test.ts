import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { RepositoryData } from '@/types/git'

const fakeBackend = vi.hoisted(() => ({
  openRepositoryImpl: null as null | ((
    path: string,
  ) => Promise<{ ok: boolean; data?: RepositoryData; message: string }>),
}))

vi.mock('@/lib/git', () => ({
  gitService: {
    get commitPage() {
      return { oldestSha: null, hasMore: false, total: null }
    },
    recentRepos: async () => [],
    removeRecent: async () => [],
    onRepositoryChanged: () => () => {},
    onProgress: () => () => {},
    openRepository: (path: string, _options?: unknown) => {
      void _options
      if (!fakeBackend.openRepositoryImpl) throw new Error('no openRepository impl set')
      return fakeBackend.openRepositoryImpl(path)
    },
  },
}))

import { useRepositoryStore } from '@/stores/repository'
import { useRepoTabsStore } from '@/stores/repoTabs'
import { useRepoTabCacheStore } from '@/stores/repoTabCache'

function repoData(path: string, name: string): RepositoryData {
  const author = { name: 'Ada', email: 'ada@example.com', avatarUrl: '', initials: 'A', color: '#fff' }
  return {
    repository: {
      name,
      path,
      gitVersion: '2.0',
      currentBranch: 'main',
      ahead: 0,
      behind: 0,
      remoteUrl: '',
    },
    commits: [
      {
        sha: `${name}-sha`,
        shortSha: name.slice(0, 7),
        parents: [],
        subject: `init ${name}`,
        author,
        committer: author,
        date: new Date('2026-01-01T00:00:00Z'),
        refs: [],
        isMerge: false,
      },
    ],
    branches: [],
    tags: [],
    stashes: [],
    worktrees: [],
    workingTree: [],
    authors: [author],
    commitAuthor: author,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  fakeBackend.openRepositoryImpl = async (path: string) => ({
    ok: true,
    data: repoData(path, path.split('/').pop() ?? path),
    message: `Opened ${path}`,
  })
})

async function openRepo(path: string): Promise<void> {
  const repo = useRepositoryStore()
  const ok = await repo.openRepository(path)
  expect(ok).toBe(true)
}

describe('tab switching (switchRepository)', () => {
  it('switches to an uncached tab via the backend service', async () => {
    const repo = useRepositoryStore()
    const tabs = useRepoTabsStore()
    await openRepo('/repo-a')
    // Tab exists (e.g. restored from recent) but was never cached.
    tabs.addTab('/repo-b', 'repo-b')
    useRepoTabCacheStore().remove('/repo-b')

    const ok = await repo.switchRepository('/repo-b')

    expect(ok).toBe(true)
    expect(repo.repository?.path).toBe('/repo-b')
    expect(tabs.activePath).toBe('/repo-b')
  })

  it('switches to a cached tab and keeps it active after background refresh', async () => {
    const repo = useRepositoryStore()
    const tabs = useRepoTabsStore()
    await openRepo('/repo-a')
    await openRepo('/repo-b')
    expect(tabs.activePath).toBe('/repo-b')

    const ok = await repo.switchRepository('/repo-a')

    expect(ok).toBe(true)
    expect(repo.repository?.path).toBe('/repo-a')
    expect(tabs.activePath).toBe('/repo-a')
    // Let the background revalidation finish; the active repo must not flip.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(repo.repository?.path).toBe('/repo-a')
    expect(tabs.activePath).toBe('/repo-a')
  })

  it('returns false instead of throwing when the backend reports failure', async () => {
    const repo = useRepositoryStore()
    await openRepo('/repo-a')
    useRepoTabsStore().addTab('/gone', 'gone')
    useRepoTabCacheStore().remove('/gone')
    fakeBackend.openRepositoryImpl = async () => ({ ok: false, message: 'nope' })

    await expect(repo.switchRepository('/gone')).resolves.toBe(false)
  })

  it('returns false instead of throwing when the backend invoke itself rejects', async () => {
    const repo = useRepositoryStore()
    await openRepo('/repo-a')
    useRepoTabsStore().addTab('/broken', 'broken')
    useRepoTabCacheStore().remove('/broken')
    fakeBackend.openRepositoryImpl = async () => {
      throw new Error('IPC failure')
    }

    // A tab click awaits this (via selectTab): a rejection here is an
    // unhandled promise rejection and the UI silently does nothing.
    await expect(repo.switchRepository('/broken')).resolves.toBe(false)
  })

  it('round-trips snapshot state with Dates through the tab cache', async () => {
    const repo = useRepositoryStore()
    await openRepo('/repo-a')
    const cache = useRepoTabCacheStore()

    expect(() => cache.save(repo)).not.toThrow()
    const cached = cache.get('/repo-a')
    expect(cached?.repository.path).toBe('/repo-a')
    expect(cached?.commits[0]?.date).toBeInstanceOf(Date)
  })
})
