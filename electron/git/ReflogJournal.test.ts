import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GitError } from '@shared/git/errors'
import type { RepoState } from '@shared/git/models'
import { ReflogJournal, isUndoRedoSafe } from './ReflogJournal'
import { gitCli } from './GitCliProvider'

vi.mock('./GitCliProvider', () => ({
  gitCli: {
    run: vi.fn(),
  },
}))

const mockRun = vi.mocked(gitCli.run)
const CWD = '/tmp/test-repo'

const SAFE_STATE: RepoState = {
  detachedHead: false,
  merging: false,
  rebasing: false,
  cherryPicking: false,
  reverting: false,
  bisecting: false,
  operationLabel: null,
}

function runResult(stdout = '') {
  return { stdout, stderr: '', exitCode: 0 }
}

beforeEach(() => {
  mockRun.mockReset()
  mockRun.mockResolvedValue(runResult())
})

describe('isUndoRedoSafe', () => {
  it('returns false while merge/rebase/cherry-pick/revert is active', () => {
    expect(isUndoRedoSafe({ ...SAFE_STATE, merging: true })).toBe(false)
    expect(isUndoRedoSafe({ ...SAFE_STATE, rebasing: true })).toBe(false)
    expect(isUndoRedoSafe({ ...SAFE_STATE, cherryPicking: true })).toBe(false)
    expect(isUndoRedoSafe({ ...SAFE_STATE, reverting: true })).toBe(false)
  })

  it('returns true when no operation is in progress', () => {
    expect(isUndoRedoSafe(SAFE_STATE)).toBe(true)
  })
})

describe('ReflogJournal', () => {
  it('tracks undo and redo labels', () => {
    const journal = new ReflogJournal()
    journal.pushUndo(
      { headSha: 'abc', branch: 'main', indexTreeSha: null },
      'Commit',
    )

    expect(journal.getState(SAFE_STATE)).toMatchObject({
      canUndo: true,
      canRedo: false,
      undoLabel: 'Commit',
      redoLabel: null,
    })
  })

  it('disables undo/redo while an operation is in progress', () => {
    const journal = new ReflogJournal()
    journal.pushUndo(
      { headSha: 'abc', branch: 'main', indexTreeSha: null },
      'Commit',
    )

    expect(journal.getState({ ...SAFE_STATE, merging: true })).toMatchObject({
      canUndo: false,
      canRedo: false,
      undoLabel: null,
      redoLabel: null,
    })
  })

  it('captures head and index checkpoints', async () => {
    mockRun
      .mockResolvedValueOnce(runResult('deadbeef'))
      .mockResolvedValueOnce(runResult('main'))
      .mockResolvedValueOnce(runResult('tree123'))

    const journal = new ReflogJournal()
    const checkpoint = await journal.capture(CWD, 'index')

    expect(checkpoint).toEqual({
      headSha: 'deadbeef',
      branch: 'main',
      indexTreeSha: 'tree123',
    })
    expect(mockRun).toHaveBeenNthCalledWith(1, ['rev-parse', 'HEAD'], expect.any(Object))
    expect(mockRun).toHaveBeenNthCalledWith(3, ['write-tree'], expect.any(Object))
  })

  it('undoes by restoring the previous checkpoint', async () => {
    mockRun
      .mockResolvedValueOnce(runResult('newhead'))
      .mockResolvedValueOnce(runResult('main'))
      .mockResolvedValueOnce(runResult('0'))
      .mockResolvedValueOnce(runResult('oldhead'))
      .mockResolvedValueOnce(runResult('main'))

    const journal = new ReflogJournal()
    journal.pushUndo(
      { headSha: 'oldhead', branch: 'main', indexTreeSha: null },
      'Commit',
    )

    const message = await journal.undo(CWD)

    expect(message).toBe('Undid Commit')
    expect(mockRun).toHaveBeenCalledWith(['checkout', 'main'], expect.objectContaining({ cwd: CWD }))
    expect(mockRun).toHaveBeenCalledWith(['reset', '--hard', 'oldhead'], expect.objectContaining({ cwd: CWD }))
    expect(journal.getState(SAFE_STATE).canRedo).toBe(true)
  })

  it('redoes a previously undone checkpoint', async () => {
    mockRun.mockResolvedValue(runResult('sha'))

    const journal = new ReflogJournal()
    journal.pushUndo(
      { headSha: 'oldhead', branch: 'main', indexTreeSha: null },
      'Commit',
    )
    await journal.undo(CWD)
    mockRun.mockClear()
    mockRun.mockResolvedValue(runResult('sha'))

    const message = await journal.redo(CWD)

    expect(message).toBe('Redid Commit')
    expect(journal.getState(SAFE_STATE).canUndo).toBe(true)
  })

  it('restores index-only checkpoints with read-tree', async () => {
    mockRun
      .mockResolvedValueOnce(runResult('samehead'))
      .mockResolvedValueOnce(runResult('main'))
      .mockResolvedValueOnce(runResult('tree-old'))
      .mockResolvedValueOnce(runResult('samehead'))

    const journal = new ReflogJournal()
    journal.pushUndo(
      { headSha: 'samehead', branch: 'main', indexTreeSha: 'tree-old' },
      'Stage file',
    )

    await journal.undo(CWD)

    expect(mockRun).toHaveBeenCalledWith(['read-tree', 'tree-old'], expect.objectContaining({ cwd: CWD }))
    expect(mockRun).not.toHaveBeenCalledWith(['reset', '--hard', 'samehead'], expect.any(Object))
  })

  it('throws when undo is requested on an empty stack', async () => {
    const journal = new ReflogJournal()
    await expect(journal.undo(CWD)).rejects.toBeInstanceOf(GitError)
  })
})
