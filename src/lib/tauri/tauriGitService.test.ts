import { describe, expect, it, vi } from 'vitest'
import type {
  CommitPageInfo,
  OpenRepoResult,
  RepoChangeEvent,
  WireRepositorySnapshot,
} from '@shared/git/models'
import { TauriGitService } from './tauriGitService'
import type { InvokeFn, ListenFn } from './invoke'

const author = {
  name: 'Ada',
  email: 'ada@example.com',
  avatarUrl: '',
  initials: 'A',
  color: '#fff',
}

function snapshotFixture(): WireRepositorySnapshot {
  return {
    repository: {
      name: 'repo',
      path: '/repo',
      gitVersion: 'git version 2.49.0',
      currentBranch: 'main',
      detached: false,
      headSha: 'abc',
      ahead: 0,
      behind: 0,
      remoteUrl: '',
      remotes: [],
      state: {
        detachedHead: false,
        merging: false,
        rebasing: false,
        cherryPicking: false,
        reverting: false,
        bisecting: false,
        operationLabel: null,
      },
      canUndo: false,
      canRedo: false,
      undoLabel: null,
      redoLabel: null,
    },
    commits: [],
    page: { oldestSha: null, hasMore: false, total: 0 } satisfies CommitPageInfo,
    branches: [],
    tags: [],
    stashes: [],
    worktrees: [],
    workingTree: [],
    authors: [],
    commitAuthor: author,
  }
}

function setup(impl: (cmd: string, args?: Record<string, unknown>) => unknown) {
  const invoker: InvokeFn = vi.fn(async (cmd, args) => impl(cmd, args))
  const handlers = new Map<string, (e: { payload: unknown }) => void>()
  const listenFn: ListenFn = vi.fn(async (event, handler) => {
    handlers.set(event, handler as (e: { payload: unknown }) => void)
    return () => {
      handlers.delete(event)
    }
  })
  return { service: new TauriGitService(invoker, listenFn), invoker, listenFn, handlers }
}

describe('TauriGitService', () => {
  it('lists recent repos via git_recent_repos', async () => {
    const repos = [{ path: '/repo', name: 'repo', lastOpened: 7 }]
    const { service, invoker } = setup(async () => repos)
    await expect(service.recentRepos()).resolves.toEqual(repos)
    expect(invoker).toHaveBeenCalledWith('git_recent_repos', undefined)
  })

  it('opens a repo and revives the snapshot', async () => {
    const result: OpenRepoResult = { ok: true, snapshot: snapshotFixture() }
    const { service, invoker } = setup(async () => result)
    const opened = await service.openRepository('/repo')
    expect(invoker).toHaveBeenCalledWith('git_open_repo', { path: '/repo', options: undefined })
    expect(opened.ok).toBe(true)
    expect(opened.data?.repository.name).toBe('repo')
    expect(opened.message).toContain('repo')
  })

  it('maps open failures to message', async () => {
    const { service } = setup(async () => ({
      ok: false,
      error: { code: 'repo-not-found', message: 'Not a repo' },
    }))
    const opened = await service.openRepository('/bad')
    expect(opened.ok).toBe(false)
    expect(opened.message).toContain('Not a repo')
  })

  it('maps action error envelopes to ActionResult', async () => {
    const { service, invoker } = setup(async () => ({
      ok: false,
      message: 'failed',
      error: { code: 'merge-conflict', message: 'Conflict', detail: 'x' },
    }))
    const result = await service.execute({ kind: 'fetch' })
    expect(invoker).toHaveBeenCalledWith('git_execute_action', { action: { kind: 'fetch' } })
    expect(result.ok).toBe(false)
    expect(result.errorCode).toBe('merge-conflict')
  })

  it('subscribes to git:changed events', async () => {
    const { service, listenFn, handlers } = setup(async () => ({}))
    const seen: RepoChangeEvent[] = []
    const unsub = service.onRepositoryChanged((e) => seen.push(e))
    expect(listenFn).toHaveBeenCalledWith('git:changed', expect.any(Function))
    handlers.get('git:changed')?.({ payload: { scopes: ['status'] } })
    // flush the promise returned by listen()
    await Promise.resolve()
    expect(seen).toEqual([{ scopes: ['status'] }])
    unsub()
  })

  it('refreshes a snapshot passing scopes through', async () => {
    const { service, invoker } = setup(async () => snapshotFixture())
    const data = await service.refreshSnapshot(['status'])
    expect(invoker).toHaveBeenCalledWith('git_snapshot', { options: { scopes: ['status'] } })
    expect(data.repository.path).toBe('/repo')
    expect(service.commitPage.hasMore).toBe(false)
  })

  it('close resets pagination state', async () => {
    const result: OpenRepoResult = { ok: true, snapshot: snapshotFixture() }
    const { service, invoker } = setup(async (cmd) => {
      if (cmd === 'git_close_repo') return undefined
      return result
    })
    await service.openRepository('/repo')
    await service.closeRepository()
    expect(invoker).toHaveBeenCalledWith('git_close_repo', undefined)
    expect(service.commitPage.oldestSha).toBeNull()
  })

  it('passes cancel and reveal through', async () => {
    const { service, invoker } = setup(async () => undefined)
    await service.cancelActiveOperation()
    await service.revealPath('/repo/file')
    expect(invoker).toHaveBeenCalledWith('git_cancel', undefined)
    expect(invoker).toHaveBeenCalledWith('git_reveal_path', { path: '/repo/file' })
  })

  it('fetches diff/blame/history/conflict through typed commands', async () => {
    const { service, invoker } = setup(async (cmd) => ({ cmd }))
    await service.getDiff({ path: 'a.ts', source: 'worktree' })
    await service.getBlame({ path: 'a.ts', source: 'index' })
    await service.getFileHistory({ path: 'a.ts', limit: 10 })
    await service.getConflict({ path: 'a.ts' })
    await service.getImagePreview({ path: 'img.png', source: 'worktree' })
    expect(invoker).toHaveBeenCalledWith('git_get_diff', { request: { path: 'a.ts', source: 'worktree' } })
    expect(invoker).toHaveBeenCalledWith('git_get_image_preview', { request: { path: 'img.png', source: 'worktree' } })
    expect(invoker).toHaveBeenCalledWith('git_get_blame', { request: { path: 'a.ts', source: 'index' } })
    expect(invoker).toHaveBeenCalledWith('git_get_file_history', { request: { path: 'a.ts', limit: 10 } })
    expect(invoker).toHaveBeenCalledWith('git_get_conflict', { request: { path: 'a.ts' } })
  })

  it('fetches commit files, compare, search and rebase commits', async () => {
    const { service, invoker } = setup(async (cmd) => (cmd === 'git_open_terminal_external' ? { ok: true } : []))
    await service.getCommitFiles('abc123')
    await service.getCompareFiles('a', 'b')
    await service.search({ text: 'fix' })
    await service.getRebaseCommits({ base: 'main' })
    expect(invoker).toHaveBeenCalledWith('git_get_commit_files', { request: { sha: 'abc123' } })
    expect(invoker).toHaveBeenCalledWith('git_get_compare_files', {
      request: { fromSha: 'a', toSha: 'b' },
    })
    expect(invoker).toHaveBeenCalledWith('git_search', { request: { text: 'fix' } })
    expect(invoker).toHaveBeenCalledWith('git_get_rebase_commits', { request: { base: 'main' } })
  })

  it('loads more commits reviving dates', async () => {
    const { service, invoker } = setup(async () => ({
      commits: [],
      page: { oldestSha: 'abc', hasMore: true, total: null },
    }))
    const result = await service.loadMoreCommits({ beforeSha: 'def' })
    expect(invoker).toHaveBeenCalledWith('git_commit_page', { request: { beforeSha: 'def' } })
    expect(result.page.oldestSha).toBe('abc')
    expect(service.commitPage.hasMore).toBe(true)
  })

  it('clones and inits repos returning opened snapshots', async () => {
    const result: OpenRepoResult = { ok: true, snapshot: snapshotFixture() }
    const { service, invoker } = setup(async () => result)
    const cloned = await service.cloneRepository({ url: 'https://github.com/o/r.git', parentPath: '/tmp' })
    expect(invoker).toHaveBeenCalledWith('git_clone_repo', {
      request: { url: 'https://github.com/o/r.git', parentPath: '/tmp' },
      options: undefined,
    })
    expect(cloned.ok).toBe(true)
    expect(cloned.data?.repository.name).toBe('repo')
    const inited = await service.initRepository({ path: '/tmp/new' })
    expect(invoker).toHaveBeenCalledWith('git_init_repo', {
      request: { path: '/tmp/new' },
      options: undefined,
    })
    expect(inited.ok).toBe(true)
  })

  it('maps clone failures to message and code', async () => {
    const { service } = setup(async () => ({
      ok: false,
      error: { __gitError: true, code: 'Authentication', message: 'Auth failed' },
    }))
    const cloned = await service.cloneRepository({ url: 'git@h:o/r.git', parentPath: '/tmp' })
    expect(cloned.ok).toBe(false)
    expect(cloned.errorCode).toBe('Authentication')
    expect(cloned.message).toContain('Auth failed')
  })

  it('discovers repos via git_discover_repos', async () => {
    const found = [{ path: '/tmp/a', name: 'a' }]
    const { service, invoker } = setup(async () => found)
    await expect(service.discoverRepositories({ root: '/tmp' })).resolves.toEqual(found)
    expect(invoker).toHaveBeenCalledWith('git_discover_repos', { request: { root: '/tmp' } })
  })
})
