import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { RepositoryData } from '@/types/git'

const fakeBackend = vi.hoisted(() => ({
  openRepositoryImpl: null as null | ((
    path: string,
  ) => Promise<{ ok: boolean; data?: RepositoryData; message: string }>),
  refreshSnapshotImpl: null as null | ((scopes?: unknown) => Promise<RepositoryData>),
  activateImpl: null as null | (() => Promise<{ ok: boolean; path?: string; message: string }>),
  changeHandler: null as null | ((event: { path: string; scopes: unknown[] }) => void),
}))

vi.mock('@/lib/git', () => ({
  gitService: {
    get commitPage() {
      return { oldestSha: null, hasMore: false, total: null }
    },
    recentRepos: async () => [],
    removeRecent: async () => [],
    onRepositoryChanged: (cb: (event: { path: string; scopes: unknown[] }) => void) => {
      fakeBackend.changeHandler = cb
      return () => {}
    },
    onProgress: () => () => {},
    activateRepository: async (path: string) => {
      if (!fakeBackend.activateImpl) return { ok: false, message: 'no impl' }
      void path
      return fakeBackend.activateImpl()
    },
    openRepository: (path: string, _options?: unknown) => {
      void _options
      if (!fakeBackend.openRepositoryImpl) throw new Error('no openRepository impl set')
      return fakeBackend.openRepositoryImpl(path)
    },
    refreshSnapshot: async (scopes?: unknown) => {
      if (!fakeBackend.refreshSnapshotImpl) throw new Error('no refreshSnapshot impl set')
      return fakeBackend.refreshSnapshotImpl(scopes)
    },
    closeRepository: async () => {},
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

/** A tab with enough sidebar rows to count as a "heavy" cached switch. */
function heavyRepoData(path: string, name: string, branchCount: number): RepositoryData {
  const data = repoData(path, name)
  data.branches = Array.from({ length: branchCount }, (_, index) => ({
    id: `${name}-b${index}`,
    name: `branch-${index}`,
    kind: 'local' as const,
    group: '',
    tipSha: `${name}-sha`,
    ahead: 0,
    behind: 0,
    isCurrent: false,
    isFavorite: false,
    lastActivity: new Date('2026-01-01T00:00:00Z'),
    laneColorIndex: 0,
  }))
  return data
}

beforeEach(() => {
  setActivePinia(createPinia())
  fakeBackend.openRepositoryImpl = async (path: string) => ({
    ok: true,
    data: repoData(path, path.split('/').pop() ?? path),
    message: `Opened ${path}`,
  })
  fakeBackend.refreshSnapshotImpl = async (scopes?: unknown) => {
    void scopes
    throw new Error('unexpected refreshSnapshot call')
  }
  fakeBackend.activateImpl = async () => ({ ok: true, message: '' })
  fakeBackend.changeHandler = null
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

    // The backend may still be serving the previous repo when the revalidation
    // lands: the refresh must discard it instead of painting repo-b over the
    // /repo-a tab (this is what mixed stashes/files between tabs used to be).
    fakeBackend.refreshSnapshotImpl = async () => repoData('/repo-b', 'repo-b')

    const ok = await repo.switchRepository('/repo-a')

    expect(ok).toBe(true)
    expect(repo.repository?.path).toBe('/repo-a')
    expect(tabs.activePath).toBe('/repo-a')
    // Let the background revalidation finish; the active repo must not flip.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(repo.repository?.path).toBe('/repo-a')
    expect(tabs.activePath).toBe('/repo-a')
  })

  it('flags the incoming repository while a cold switch loads', async () => {
    const repo = useRepositoryStore()
    const tabs = useRepoTabsStore()
    await openRepo('/repo-a')
    tabs.addTab('/repo-b', 'repo-b')
    tabs.setActive('/repo-a')
    useRepoTabCacheStore().remove('/repo-b')

    let resolveOpen: ((result: { ok: boolean; data?: RepositoryData; message: string }) => void) | undefined
    fakeBackend.openRepositoryImpl = () =>
      new Promise((resolve) => {
        resolveOpen = resolve
      })

    const switching = repo.switchRepository('/repo-b')
    await new Promise((resolve) => setTimeout(resolve, 0))

    // `pendingRepoPath` is what the UI turns into the loading skeleton; the tab
    // bar already points at the requested tab so both agree while loading.
    expect(repo.pendingRepoPath).toBe('/repo-b')
    expect(tabs.activePath).toBe('/repo-b')

    resolveOpen?.({ ok: true, data: repoData('/repo-b', 'repo-b'), message: 'Opened /repo-b' })
    await expect(switching).resolves.toBe(true)

    // The skeleton outlives the open by one frame: it must stay up until the
    // new snapshot has actually painted (the paint itself is what blocks).
    expect(repo.pendingRepoPath).toBe('/repo-b')
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(repo.pendingRepoPath).toBeNull()
    expect(repo.repository?.path).toBe('/repo-b')
  })

  it('clears the skeleton flag and restores the previous tab when a cold switch fails', async () => {
    const repo = useRepositoryStore()
    const tabs = useRepoTabsStore()
    await openRepo('/repo-a')
    tabs.addTab('/broken', 'broken')
    tabs.setActive('/repo-a')
    useRepoTabCacheStore().remove('/broken')
    fakeBackend.openRepositoryImpl = async () => ({ ok: false, message: 'nope' })

    await expect(repo.switchRepository('/broken')).resolves.toBe(false)

    expect(repo.pendingRepoPath).toBeNull()
    expect(tabs.activePath).toBe('/repo-a')
    expect(repo.repository?.path).toBe('/repo-a')
  })

  it('drops the skeleton when a cached switch supersedes an in-flight cold switch', async () => {
    const repo = useRepositoryStore()
    const tabs = useRepoTabsStore()
    await openRepo('/repo-a')
    tabs.addTab('/repo-b', 'repo-b')
    tabs.setActive('/repo-a')
    useRepoTabCacheStore().remove('/repo-b')

    let resolveOpen: ((result: { ok: boolean; data?: RepositoryData; message: string }) => void) | undefined
    fakeBackend.openRepositoryImpl = () =>
      new Promise((resolve) => {
        resolveOpen = resolve
      })

    const cold = repo.switchRepository('/repo-b')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(repo.pendingRepoPath).toBe('/repo-b')

    // The user moves on to an already-cached tab before the slow one lands.
    await expect(repo.switchRepository('/repo-a')).resolves.toBe(true)
    expect(repo.pendingRepoPath).toBeNull()

    // The abandoned cold open must not resurrect the skeleton afterwards.
    resolveOpen?.({ ok: true, data: repoData('/repo-b', 'repo-b'), message: 'Opened /repo-b' })
    await cold
    expect(repo.pendingRepoPath).toBeNull()
    expect(repo.repository?.path).toBe('/repo-a')
  })

  it('clears the skeleton and ignores the result when the repo is closed mid-switch', async () => {
    const repo = useRepositoryStore()
    const tabs = useRepoTabsStore()
    await openRepo('/repo-a')
    tabs.addTab('/repo-b', 'repo-b')
    tabs.setActive('/repo-a')
    useRepoTabCacheStore().remove('/repo-b')

    let resolveOpen: ((result: { ok: boolean; data?: RepositoryData; message: string }) => void) | undefined
    fakeBackend.openRepositoryImpl = () =>
      new Promise((resolve) => {
        resolveOpen = resolve
      })

    const cold = repo.switchRepository('/repo-b')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(repo.pendingRepoPath).toBe('/repo-b')

    await repo.closeRepository()
    expect(repo.pendingRepoPath).toBeNull()

    resolveOpen?.({ ok: true, data: repoData('/repo-b', 'repo-b'), message: 'Opened /repo-b' })
    await cold
    // The closed repository must not come back from the abandoned open.
    expect(repo.pendingRepoPath).toBeNull()
    expect(repo.repository).toBeNull()
    expect(repo.screen).toBe('startup')
  })

  it('raises the skeleton before painting a heavy cached tab, then clears it', async () => {
    const repo = useRepositoryStore()
    const tabs = useRepoTabsStore()
    await openRepo('/repo-a')
    fakeBackend.openRepositoryImpl = async (path: string) => ({
      ok: true,
      data: path === '/repo-heavy' ? heavyRepoData(path, 'repo-heavy', 350) : repoData(path, 'repo-a'),
      message: `Opened ${path}`,
    })
    await openRepo('/repo-heavy')
    await repo.switchRepository('/repo-a')
    expect(repo.pendingRepoPath).toBeNull()

    // Back to the heavy tab: the cached entry is big enough to block the first
    // paint, so the skeleton must be up *before* the store is patched.
    const switching = repo.switchRepository('/repo-heavy')
    expect(repo.pendingRepoPath).toBe('/repo-heavy')
    expect(repo.pendingRepoHeavy).toBe(true)
    // The outgoing repository is still on screen behind the skeleton.
    expect(repo.repository?.path).toBe('/repo-a')
    expect(tabs.activePath).toBe('/repo-a')

    // After the paint frame the tab is active and nothing is covered anymore.
    await expect(switching).resolves.toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(repo.repository?.path).toBe('/repo-heavy')
    expect(tabs.activePath).toBe('/repo-heavy')
    expect(repo.pendingRepoPath).toBeNull()
    expect(repo.pendingRepoHeavy).toBe(false)
  })

  it('never flags a cached tab: it paints the snapshot before returning', async () => {
    const repo = useRepositoryStore()
    await openRepo('/repo-a')
    await openRepo('/repo-b')

    const switching = repo.switchRepository('/repo-a')

    // Painted synchronously — no skeleton, not even for one tick.
    expect(repo.repository?.path).toBe('/repo-a')
    expect(repo.pendingRepoPath).toBeNull()
    await expect(switching).resolves.toBe(true)
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

  it('finds cache entries saved under a different path spelling', async () => {
    const cache = useRepoTabCacheStore()
    await openRepo('/repo-a')
    const cached = cache.get('/repo-a')
    expect(cached).toBeDefined()
    const entry = { ...cached!, path: '/repo-a/' }
    cache.set(entry)

    expect(cache.has('/repo-a')).toBe(true)
    expect(cache.get('/repo-a/')?.repository.path).toBe('/repo-a')
  })

  it('discards snapshot refreshes that belong to a different repository', async () => {
    const repo = useRepositoryStore()
    await openRepo('/repo-a')
    fakeBackend.refreshSnapshotImpl = async () => repoData('/repo-z', 'repo-z')

    await repo.refreshSnapshot(['status'])

    // The scoped snapshot for /repo-z must not leak into the /repo-a tab.
    expect(repo.repository?.path).toBe('/repo-a')
  })

  it('ignores watcher change events for a repository that is not on screen', async () => {
    const repo = useRepositoryStore()
    await repo.init()
    await openRepo('/repo-a')
    expect(fakeBackend.changeHandler).toBeTruthy()
    fakeBackend.refreshSnapshotImpl = async () => repoData('/repo-z', 'repo-z')

    const handler = fakeBackend.changeHandler
    if (!handler) throw new Error('onRepositoryChanged was not registered')
    handler({ path: '/repo-z', scopes: ['stashes'] })
    // scheduleSnapshotRefresh debounces for 150ms before invoking.
    await new Promise((resolve) => setTimeout(resolve, 300))

    expect(repo.repository?.path).toBe('/repo-a')
  })
})

describe('stale open/switch results', () => {
  it('never applies an openRepository result superseded by another switch', async () => {
    const repo = useRepositoryStore()
    await openRepo('/repo-a')
    useRepoTabsStore().addTab('/repo-b', 'repo-b')
    useRepoTabCacheStore().remove('/repo-b')

    let resolveSlow!: (value: { ok: boolean; data?: RepositoryData; message: string }) => void
    const slowOpen = new Promise<{ ok: boolean; data?: RepositoryData; message: string }>(
      (resolve) => {
        resolveSlow = resolve
      },
    )
    fakeBackend.openRepositoryImpl = (path: string) =>
      path === '/repo-slow'
        ? slowOpen
        : Promise.resolve({
            ok: true,
            data: repoData(path, path.split('/').pop() ?? path),
            message: `Opened ${path}`,
          })

    const slow = repo.openRepository('/repo-slow')
    // The fast switch completes while the slow open is still in flight.
    const switched = await repo.switchRepository('/repo-b')
    expect(switched).toBe(true)
    expect(repo.repository?.path).toBe('/repo-b')

    resolveSlow({ ok: true, data: repoData('/repo-slow', 'repo-slow'), message: 'Opened slow' })
    await expect(slow).resolves.toBe(false)
    // The losing open must not win the store / tab bar.
    expect(repo.repository?.path).toBe('/repo-b')
    expect(useRepoTabsStore().activePath).toBe('/repo-b')
  })
})
