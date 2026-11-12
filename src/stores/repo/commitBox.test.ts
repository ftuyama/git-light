import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commitBoxActions } from './commitBox'

const mocks = vi.hoisted(() => ({
  selectFile: vi.fn(),
  runAction: vi.fn(),
}))

vi.mock('@/stores/repoDiff', () => ({
  useRepoDiffStore: () => ({ selectFile: mocks.selectFile }),
}))

vi.mock('@/stores/ui', () => ({
  useUiStore: () => ({ signOffCommit: false, signCommit: false }),
}))

function commitStore(ok: boolean) {
  mocks.runAction.mockResolvedValue(ok)
  return {
    canCommit: true,
    amend: false,
    commitMessage: 'Subject',
    commitDescription: 'Body',
    preAmendDraft: null,
    runAction: mocks.runAction,
  }
}

describe('commitBox.commit', () => {
  beforeEach(() => {
    mocks.selectFile.mockReset()
    mocks.runAction.mockReset()
  })

  it('closes the open file diff after a successful commit', async () => {
    await commitBoxActions.commit.call(commitStore(true) as never)

    expect(mocks.selectFile).toHaveBeenCalledWith(null)
  })

  it('keeps the open file diff when the commit fails', async () => {
    await commitBoxActions.commit.call(commitStore(false) as never)

    expect(mocks.selectFile).not.toHaveBeenCalled()
  })
})
