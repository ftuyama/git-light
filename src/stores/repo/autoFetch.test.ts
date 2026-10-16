import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { GitAction } from '@shared/git/actions'
import type { RepositoryData } from '@/types/git'

const fakeBackend = vi.hoisted(() => ({
  executeCalls: [] as GitAction[],
  executeImpl: null as null | ((action: GitAction) => Promise<{ ok: boolean; message: string }>),
  refreshCalls: 0,
}))

vi.mock('@/lib/git', () => ({
  gitService: {
    get commitPage() {
      return { oldestSha: null, hasMore: false, total: null }
    },
    recentRepos: async () => [],
    onRepositoryChanged: () => () => {},
    onProgress: () => () => {},
    execute: (action: GitAction) => {
      fakeBackend.executeCalls.push(action)
      if (!fakeBackend.executeImpl) throw new Error('no execute impl set')
      return fakeBackend.executeImpl(action)
    },
    refreshSnapshot: async () => {
      fakeBackend.refreshCalls += 1
      return {
        repository: { name: 'repo', path: '/repo' },
        commits: [],
        branches: [],
        tags: [],
        stashes: [],
        worktrees: [],
        workingTree: [],
        authors: [],
        commitAuthor: null,
      } as unknown as RepositoryData
    },
  },
}))

import { useRepositoryStore } from '@/stores/repository'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'

function openFakeRepo(): void {
  const repo = useRepositoryStore()
  repo.repository = { name: 'repo', path: '/repo' } as unknown as RepositoryData['repository']
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  fakeBackend.executeCalls = []
  fakeBackend.refreshCalls = 0
  fakeBackend.executeImpl = async () => ({ ok: true, message: 'Fetched from all remotes' })
})

describe('auto-fetch (silent background fetch)', () => {
  it('fetches silently on the configured interval with no toast or banner', async () => {
    const repo = useRepositoryStore()
    openFakeRepo()
    useUiStore().setAutoFetchIntervalSec(60)

    repo.restartAutoFetch()
    expect(fakeBackend.executeCalls).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(fakeBackend.executeCalls).toEqual([{ kind: 'fetch' }])
    // Silent: no toast, no operation banner, no cancel button.
    expect(useToastStore().toasts).toHaveLength(0)
    expect(repo.operation).toBeNull()
    expect(repo.operationPhase).toBeNull()
    expect(repo.busyAction).toBeNull()
    expect(repo.canCancel).toBe(false)
    // Fresh refs land via a scoped snapshot refresh.
    expect(fakeBackend.refreshCalls).toBe(1)
  })

  it('reschedules after each tick from the current settings', async () => {
    const repo = useRepositoryStore()
    openFakeRepo()
    useUiStore().setAutoFetchIntervalSec(60)

    repo.restartAutoFetch()
    await vi.advanceTimersByTimeAsync(60_000)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fakeBackend.executeCalls).toHaveLength(2)
  })

  it('stays stopped when the interval is Disabled (0)', async () => {
    const repo = useRepositoryStore()
    openFakeRepo()
    useUiStore().setAutoFetchIntervalSec(0)

    repo.restartAutoFetch()
    await vi.advanceTimersByTimeAsync(3_600_000)
    expect(fakeBackend.executeCalls).toHaveLength(0)
  })

  it('stays stopped with no repo open and stops on demand', async () => {
    const repo = useRepositoryStore()
    useUiStore().setAutoFetchIntervalSec(60)

    repo.restartAutoFetch()
    await vi.advanceTimersByTimeAsync(600_000)
    expect(fakeBackend.executeCalls).toHaveLength(0)

    openFakeRepo()
    repo.restartAutoFetch()
    repo.stopAutoFetch()
    await vi.advanceTimersByTimeAsync(600_000)
    expect(fakeBackend.executeCalls).toHaveLength(0)
  })

  it('skips ticks while a manual operation owns the banner', async () => {
    const repo = useRepositoryStore()
    openFakeRepo()
    useUiStore().setAutoFetchIntervalSec(60)

    repo.restartAutoFetch()
    repo.busyAction = 'push'
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fakeBackend.executeCalls).toHaveLength(0)

    repo.busyAction = null
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fakeBackend.executeCalls).toHaveLength(1)
  })

  it('swallows fetch failures silently and retries on the next tick', async () => {
    const repo = useRepositoryStore()
    openFakeRepo()
    useUiStore().setAutoFetchIntervalSec(60)
    fakeBackend.executeImpl = async () => ({ ok: false, message: 'network down' })

    repo.restartAutoFetch()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fakeBackend.executeCalls).toHaveLength(1)
    expect(useToastStore().toasts).toHaveLength(0)
    expect(fakeBackend.refreshCalls).toBe(0)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(fakeBackend.executeCalls).toHaveLength(2)
  })

  it('ignores backend progress noise while a silent fetch is in flight', async () => {
    const repo = useRepositoryStore()
    openFakeRepo()
    let release!: () => void
    const gate = new Promise<{ ok: boolean; message: string }>((resolve) => {
      release = () => resolve({ ok: true, message: 'Fetched from all remotes' })
    })
    fakeBackend.executeImpl = () => gate

    const pending = repo.runAutoFetch()
    // Let the action reach the in-flight fetch.
    await vi.advanceTimersByTimeAsync(0)
    repo.onProgress({
      operationId: 'auto',
      kind: 'fetch',
      phase: 'Receiving objects: 42%',
      percent: 42,
      done: false,
    })
    expect(repo.operationPhase).toBeNull()
    expect(repo.canCancel).toBe(false)

    release()
    await pending
    await vi.advanceTimersByTimeAsync(0)
  })

  it('still shows live progress for manual operations', () => {
    const repo = useRepositoryStore()
    openFakeRepo()
    repo.busyAction = 'push'
    repo.onProgress({
      operationId: 'manual',
      kind: 'push',
      phase: 'Writing objects: 42%',
      percent: 42,
      done: false,
    })
    expect(repo.operationPhase).toBe('Writing objects: 42%')
    expect(repo.canCancel).toBe(true)
  })
})
