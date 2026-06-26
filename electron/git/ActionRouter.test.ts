import { readFileSync, writeFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GitError } from '@shared/git/errors'
import type { GitAction } from '@shared/git/actions'
import { executeGitAction, isDestructiveAction } from './ActionRouter'
import { gitCli } from './GitCliProvider'
import { createRebaseEditorBundle } from './rebaseSequenceEditor'

vi.mock('./GitCliProvider', () => ({
  gitCli: {
    run: vi.fn(),
    runStreaming: vi.fn(),
  },
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
})

vi.mock('./rebaseSequenceEditor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./rebaseSequenceEditor')>()
  return {
    ...actual,
    createRebaseEditorBundle: vi.fn(),
  }
})

const mockReadFileSync = vi.mocked(readFileSync)
const mockWriteFileSync = vi.mocked(writeFileSync)
const mockCreateRebaseEditorBundle = vi.mocked(createRebaseEditorBundle)

const mockRun = vi.mocked(gitCli.run)
const mockRunStreaming = vi.mocked(gitCli.runStreaming)

const CWD = '/tmp/test-repo'

function ctx(overrides: { signal?: AbortSignal; onProgress?: (phase: string, percent: number | null) => void } = {}) {
  return { cwd: CWD, ...overrides }
}

function runResult(stdout = '') {
  return { stdout, stderr: '', exitCode: 0 }
}

beforeEach(() => {
  mockRun.mockReset()
  mockRunStreaming.mockReset()
  mockReadFileSync.mockReset()
  mockWriteFileSync.mockReset()
  mockCreateRebaseEditorBundle.mockReset()
  mockRun.mockResolvedValue(runResult())
  mockRunStreaming.mockResolvedValue(runResult())
})

describe('isDestructiveAction', () => {
  it.each([
    'reset-hard',
    'force-push',
    'commit-and-force-push',
    'delete-branch',
    'delete-remote-branch',
    'drop-stash',
    'discard-file',
    'discard-all',
  ])('returns true for %s', (kind) => {
    expect(isDestructiveAction(kind)).toBe(true)
  })

  it.each(['fetch', 'commit', 'stage', 'checkout', 'merge', 'refresh'])(
    'returns false for %s',
    (kind) => {
      expect(isDestructiveAction(kind)).toBe(false)
    },
  )
})

describe('executeGitAction', () => {
  describe('error handling', () => {
    it('serializes GitError with conflict files', async () => {
      const gitError = new GitError('MergeConflict', 'Conflicts', { files: ['a.ts', 'b.ts'] })
      mockRun.mockRejectedValueOnce(gitError)

      const result = await executeGitAction({ kind: 'merge', target: 'feature' }, ctx())

      expect(result.ok).toBe(false)
      expect(result.message).toBe('Conflicts')
      expect(result.error).toEqual(gitError.serialize())
      expect(result.conflicts).toEqual(['a.ts', 'b.ts'])
    })

    it('wraps non-GitError failures', async () => {
      mockRun.mockRejectedValueOnce(new Error('disk full'))

      const result = await executeGitAction({ kind: 'pull' }, ctx())

      expect(result.ok).toBe(false)
      expect(result.message).toBe('disk full')
      expect(result.error).toMatchObject({ code: 'Unknown', message: 'disk full' })
    })
  })

  describe('validation', () => {
    it.each([
      ['stage', { kind: 'stage' as const }, 'No file specified.'],
      ['unstage', { kind: 'unstage' as const }, 'No file specified.'],
      ['discard-file', { kind: 'discard-file' as const }, 'No file specified.'],
      ['checkout', { kind: 'checkout' as const }, 'No branch specified.'],
      ['merge', { kind: 'merge' as const }, 'No branch to merge.'],
      ['delete-branch', { kind: 'delete-branch' as const }, 'No branch specified.'],
    ])('rejects %s without a target', async (_label, action, message) => {
      const result = await executeGitAction(action, ctx())

      expect(result.ok).toBe(false)
      expect(result.message).toBe(message)
      expect(mockRun).not.toHaveBeenCalled()
    })

    it('rejects commit without a message', async () => {
      const result = await executeGitAction({ kind: 'commit', meta: { message: '   ' } }, ctx())

      expect(result.ok).toBe(false)
      expect(result.error).toMatchObject({ code: 'NothingToCommit' })
      expect(mockRun).not.toHaveBeenCalled()
    })

    it('rejects path traversal for file operations', async () => {
      const result = await executeGitAction({ kind: 'stage', target: '../../etc/passwd' }, ctx())

      expect(result.ok).toBe(false)
      expect(result.message).toBe('Path escapes the repository root.')
      expect(mockRun).not.toHaveBeenCalled()
    })

    it('rejects stage-patch without patch content', async () => {
      const result = await executeGitAction(
        { kind: 'stage-patch', target: 'src/file.ts', meta: { patch: '  ' } },
        ctx(),
      )

      expect(result.ok).toBe(false)
      expect(result.message).toBe('No patch specified.')
      expect(mockRun).not.toHaveBeenCalled()
    })

    it('rejects resolve-conflict-block with invalid block index', async () => {
      const result = await executeGitAction(
        { kind: 'resolve-conflict-block', target: 'file.ts', meta: { blockIndex: -1 } },
        ctx(),
      )

      expect(result.ok).toBe(false)
      expect(result.message).toBe('Invalid conflict block index.')
    })

    it('rejects interactive-rebase without entries', async () => {
      const result = await executeGitAction(
        { kind: 'interactive-rebase', target: 'main', meta: { entries: [] } },
        ctx(),
      )

      expect(result.ok).toBe(false)
      expect(result.message).toBe('No rebase plan specified.')
      expect(mockRun).not.toHaveBeenCalled()
    })

    it('rejects unsupported action kinds', async () => {
      const result = await executeGitAction({ kind: 'not-a-real-action' as GitAction['kind'] }, ctx())

      expect(result.ok).toBe(false)
      expect(result.message).toContain('Unsupported action')
    })
  })

  describe('remote operations', () => {
    it('fetch streams progress lines', async () => {
      const onProgress = vi.fn()

      const result = await executeGitAction({ kind: 'fetch' }, ctx({ onProgress }))

      expect(result.ok).toBe(true)
      expect(mockRunStreaming).toHaveBeenCalledWith(
        ['fetch', '--all'],
        { cwd: CWD, signal: undefined },
        expect.any(Function),
      )
      const onLine = mockRunStreaming.mock.calls[0][2]!
      onLine('Receiving objects: 50%', 'stdout')
      expect(onProgress).toHaveBeenCalledWith('Receiving objects: 50%', null)
    })

    it('fetch-all prunes remotes', async () => {
      const result = await executeGitAction({ kind: 'fetch-all' }, ctx())

      expect(result.ok).toBe(true)
      expect(mockRunStreaming).toHaveBeenCalledWith(
        ['fetch', '--all', '--prune'],
        expect.any(Object),
        expect.any(Function),
      )
      expect(result.message).toBe('Fetched and pruned remotes')
    })

    it('sync fetches then pulls', async () => {
      const result = await executeGitAction({ kind: 'sync' }, ctx())

      expect(result.ok).toBe(true)
      expect(mockRunStreaming).toHaveBeenCalledWith(['fetch', '--all'], expect.any(Object), expect.any(Function))
      expect(mockRun).toHaveBeenCalledWith(['pull', '--ff-only'], { cwd: CWD, signal: undefined })
      expect(result.message).toBe('Synced with remote')
    })

    it('force-push uses --force-with-lease', async () => {
      const result = await executeGitAction({ kind: 'force-push' }, ctx())

      expect(result.ok).toBe(true)
      expect(mockRunStreaming).toHaveBeenCalledWith(
        ['push', '--force-with-lease'],
        expect.any(Object),
        expect.any(Function),
      )
      expect(result.message).toBe('Force-pushed to remote')
    })
  })

  describe('stash', () => {
    it('stash pushes with message and flags', async () => {
      const result = await executeGitAction(
        {
          kind: 'stash',
          meta: { message: 'save wip', includeUntracked: true, keepIndex: true },
        },
        ctx(),
      )

      expect(result.ok).toBe(true)
      expect(mockRun).toHaveBeenCalledWith(
        ['stash', 'push', '-m', 'save wip', '-u', '-k'],
        { cwd: CWD, signal: undefined },
      )
    })

    it('pop-stash defaults to stash@{0}', async () => {
      await executeGitAction({ kind: 'pop-stash' }, ctx())

      expect(mockRun).toHaveBeenCalledWith(['stash', 'pop', 'stash@{0}'], { cwd: CWD, signal: undefined })
    })
  })

  describe('working tree', () => {
    it('stages a file inside the repo', async () => {
      const result = await executeGitAction({ kind: 'stage', target: 'src/app.ts' }, ctx())

      expect(result.ok).toBe(true)
      expect(mockRun).toHaveBeenCalledWith(['add', '--', 'src/app.ts'], { cwd: CWD, signal: undefined })
      expect(result.message).toBe('Staged src/app.ts')
    })

    it('applies a cached patch for stage-patch with intentToAdd', async () => {
      const patch = 'diff --git a/new.ts b/new.ts\n'
      const result = await executeGitAction(
        { kind: 'stage-patch', target: 'new.ts', meta: { patch, intentToAdd: true } },
        ctx(),
      )

      expect(result.ok).toBe(true)
      expect(mockRun).toHaveBeenNthCalledWith(1, ['add', '-N', '--', 'new.ts'], {
        cwd: CWD,
        signal: undefined,
        allowFailure: true,
      })
      expect(mockRun).toHaveBeenNthCalledWith(2, ['apply', '--cached'], {
        cwd: CWD,
        signal: undefined,
        input: patch,
      })
    })

    it('reverses cached patch for unstage-patch', async () => {
      const patch = 'diff --git a/file.ts b/file.ts\n'
      await executeGitAction({ kind: 'unstage-patch', target: 'file.ts', meta: { patch } }, ctx())

      expect(mockRun).toHaveBeenCalledWith(['apply', '--cached', '-R'], {
        cwd: CWD,
        signal: undefined,
        input: patch,
      })
    })

    it('discard-all checks out the whole tree', async () => {
      await executeGitAction({ kind: 'discard-all' }, ctx())

      expect(mockRun).toHaveBeenCalledWith(['checkout', '--', '.'], { cwd: CWD, signal: undefined })
    })
  })

  describe('conflict resolution', () => {
    it('resolve-conflict-ours checks out and stages', async () => {
      await executeGitAction({ kind: 'resolve-conflict-ours', target: 'conflict.ts' }, ctx())

      expect(mockRun).toHaveBeenNthCalledWith(1, ['checkout', '--ours', '--', 'conflict.ts'], {
        cwd: CWD,
        signal: undefined,
      })
      expect(mockRun).toHaveBeenNthCalledWith(2, ['add', '--', 'conflict.ts'], { cwd: CWD, signal: undefined })
    })

    it('resolve-conflict-block writes resolved content and stages when clean', async () => {
      mockReadFileSync.mockReturnValue(`<<<<<<< HEAD
ours
=======
theirs
>>>>>>> branch
`)

      const result = await executeGitAction(
        { kind: 'resolve-conflict-block', target: 'file.ts', meta: { blockIndex: 0, side: 'ours' } },
        ctx(),
      )

      expect(result.ok).toBe(true)
      expect(mockReadFileSync).toHaveBeenCalledWith(`${CWD}/file.ts`, 'utf8')
      expect(mockWriteFileSync).toHaveBeenCalledWith(`${CWD}/file.ts`, 'ours\n', 'utf8')
      expect(mockRun).toHaveBeenCalledWith(['add', '--', 'file.ts'], { cwd: CWD, signal: undefined })
    })
  })

  describe('commit flows', () => {
    it('commit passes title, body, and sign-off', async () => {
      await executeGitAction(
        { kind: 'commit', meta: { message: 'Title', body: 'Body', signOff: true } },
        ctx(),
      )

      expect(mockRun).toHaveBeenCalledWith(
        ['commit', '-m', 'Title', '-m', 'Body', '--signoff'],
        { cwd: CWD, signal: undefined },
      )
    })

    it('amend without message keeps --no-edit', async () => {
      await executeGitAction({ kind: 'amend' }, ctx())

      expect(mockRun).toHaveBeenCalledWith(['commit', '--amend', '--no-edit'], { cwd: CWD, signal: undefined })
    })

    it('commit-and-push chains commit then push', async () => {
      const result = await executeGitAction(
        { kind: 'commit-and-push', meta: { message: 'Ship it' } },
        ctx(),
      )

      expect(result.ok).toBe(true)
      expect(mockRun).toHaveBeenNthCalledWith(1, ['commit', '-m', 'Ship it'], { cwd: CWD, signal: undefined })
      expect(mockRunStreaming).toHaveBeenCalledWith(['push'], expect.any(Object), expect.any(Function))
      expect(result.message).toBe('Committed and pushed')
    })

    it('commit-and-force-push chains commit then force push', async () => {
      const result = await executeGitAction(
        { kind: 'commit-and-force-push', meta: { message: 'Rewrite', amend: true } },
        ctx(),
      )

      expect(result.ok).toBe(true)
      expect(mockRun).toHaveBeenNthCalledWith(1, ['commit', '--amend', '-m', 'Rewrite'], {
        cwd: CWD,
        signal: undefined,
      })
      expect(mockRunStreaming).toHaveBeenCalledWith(
        ['push', '--force-with-lease'],
        expect.any(Object),
        expect.any(Function),
      )
      expect(result.message).toBe('Amended and force-pushed')
    })
  })

  describe('branches and merge', () => {
    it('checkout tracks a remote branch', async () => {
      await executeGitAction(
        { kind: 'checkout', target: 'feature', meta: { remote: 'origin' } },
        ctx(),
      )

      expect(mockRun).toHaveBeenCalledWith(['checkout', '-b', 'feature', 'origin/feature'], {
        cwd: CWD,
        signal: undefined,
      })
    })

    it('merge honors ff-only, no-ff, and squash flags', async () => {
      await executeGitAction({ kind: 'merge', target: 'dev', meta: { ffOnly: true } }, ctx())
      expect(mockRun).toHaveBeenLastCalledWith(['merge', '--ff-only', 'dev'], { cwd: CWD, signal: undefined })

      await executeGitAction({ kind: 'merge', target: 'dev', meta: { noFf: true } }, ctx())
      expect(mockRun).toHaveBeenLastCalledWith(['merge', '--no-ff', 'dev'], { cwd: CWD, signal: undefined })

      await executeGitAction({ kind: 'merge', target: 'dev', meta: { squash: true } }, ctx())
      expect(mockRun).toHaveBeenLastCalledWith(['merge', '--squash', 'dev'], { cwd: CWD, signal: undefined })
    })

    it('delete-branch uses -D when forced', async () => {
      await executeGitAction({ kind: 'delete-branch', target: 'old', meta: { force: true } }, ctx())

      expect(mockRun).toHaveBeenCalledWith(['branch', '-D', 'old'], { cwd: CWD, signal: undefined })
    })

    it('compare-branches counts commits with allowFailure', async () => {
      mockRun.mockResolvedValueOnce(runResult('abc1234 One\n def5678 Two\n'))

      const result = await executeGitAction(
        { kind: 'compare-branches', target: 'main', meta: { other: 'feature' } },
        ctx(),
      )

      expect(mockRun).toHaveBeenCalledWith(['log', '--oneline', 'main..feature'], {
        cwd: CWD,
        signal: undefined,
        allowFailure: true,
      })
      expect(result.message).toBe('2 commits in feature not in main')
    })
  })

  describe('history rewrite', () => {
    it('reset-hard targets HEAD by default', async () => {
      await executeGitAction({ kind: 'reset-hard' }, ctx())

      expect(mockRun).toHaveBeenCalledWith(['reset', '--hard', 'HEAD'], { cwd: CWD, signal: undefined })
    })

    it('interactive-rebase passes editor env and cleans up', async () => {
      const cleanup = vi.fn()
      mockCreateRebaseEditorBundle.mockReturnValue({
        env: { GIT_SEQUENCE_EDITOR: 'node /tmp/editor.js' },
        cleanup,
      })

      const entries = [{ action: 'pick' as const, sha: 'abc1234', subject: 'Init' }]
      const result = await executeGitAction(
        { kind: 'interactive-rebase', target: 'main~3', meta: { entries } },
        ctx(),
      )

      expect(result.ok).toBe(true)
      expect(mockCreateRebaseEditorBundle).toHaveBeenCalledWith(entries)
      expect(mockRun).toHaveBeenCalledWith(['rebase', '-i', 'main~3'], {
        cwd: CWD,
        signal: undefined,
        env: { GIT_SEQUENCE_EDITOR: 'node /tmp/editor.js' },
      })
      expect(cleanup).toHaveBeenCalled()
    })
  })

  describe('tags and noop actions', () => {
    it('create-tag builds annotated tags', async () => {
      await executeGitAction(
        { kind: 'create-tag', meta: { name: 'v1.0.0', annotated: true, message: 'Release' } },
        ctx(),
      )

      expect(mockRun).toHaveBeenCalledWith(['tag', '-a', 'v1.0.0', '-m', 'Release'], {
        cwd: CWD,
        signal: undefined,
      })
    })

    it('refresh is a no-op success', async () => {
      const result = await executeGitAction({ kind: 'refresh' }, ctx())

      expect(result.ok).toBe(true)
      expect(result.message).toBe('Repository refreshed')
      expect(mockRun).not.toHaveBeenCalled()
    })

    it('renderer-only actions return a handled message', async () => {
      const result = await executeGitAction({ kind: 'open-on-github', target: 'abc1234' }, ctx())

      expect(result.ok).toBe(true)
      expect(result.message).toBe('Handled in renderer')
      expect(mockRun).not.toHaveBeenCalled()
    })
  })

  describe('undo/redo', () => {
    it('rejects undo when journal is missing', async () => {
      const result = await executeGitAction({ kind: 'undo' }, ctx())

      expect(result.ok).toBe(false)
      expect(result.message).toBe('Undo is not available.')
    })

    it('rejects undo while an operation is in progress', async () => {
      const journal = {
        undo: vi.fn(),
        redo: vi.fn(),
      }
      const result = await executeGitAction(
        { kind: 'undo' },
        {
          ...ctx(),
          journal: journal as never,
          repoState: {
            detachedHead: false,
            merging: true,
            rebasing: false,
            cherryPicking: false,
            reverting: false,
            bisecting: false,
            operationLabel: 'MERGING',
          },
        },
      )

      expect(result.ok).toBe(false)
      expect(result.message).toBe('Cannot undo while an operation is in progress.')
      expect(journal.undo).not.toHaveBeenCalled()
    })

    it('delegates undo to the journal', async () => {
      const journal = {
        undo: vi.fn().mockResolvedValue('Undid Commit'),
        redo: vi.fn(),
      }

      const result = await executeGitAction(
        { kind: 'undo' },
        { ...ctx(), journal: journal as never, repoState: undefined },
      )

      expect(result.ok).toBe(true)
      expect(result.message).toBe('Undid Commit')
      expect(journal.undo).toHaveBeenCalledWith(CWD, undefined)
    })
  })
})
