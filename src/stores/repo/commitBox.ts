import type { GitAction } from '@/types/git'
import { useRepoDiffStore } from '@/stores/repoDiff'
import type { RepositoryState } from './types'

type CommitBoxStore = RepositoryState & {
  canCommit: boolean
  stagedFiles: { length: number }
  workingTree: RepositoryState['workingTree']
  runAction(action: GitAction, options?: { skipConfirm?: boolean }): Promise<boolean>
}

export const commitBoxActions = {
  toggleStaged(this: CommitBoxStore, fileId: string): void {
    const file = this.workingTree.find((f) => f.id === fileId)
    if (!file) return
    void this.runAction({ kind: file.staged ? 'unstage' : 'stage', target: file.path })
  },

  async resolveConflictOurs(this: CommitBoxStore, path: string): Promise<void> {
    await this.runAction({ kind: 'resolve-conflict-ours', target: path }, { skipConfirm: true })
    await useRepoDiffStore().afterConflictAction(path)
  },

  async resolveConflictTheirs(this: CommitBoxStore, path: string): Promise<void> {
    await this.runAction({ kind: 'resolve-conflict-theirs', target: path }, { skipConfirm: true })
    await useRepoDiffStore().afterConflictAction(path)
  },

  async resolveConflictBlock(
    this: CommitBoxStore,
    path: string,
    blockIndex: number,
    side: 'ours' | 'theirs',
  ): Promise<void> {
    await this.runAction(
      { kind: 'resolve-conflict-block', target: path, meta: { blockIndex, side } },
      { skipConfirm: true },
    )
    await useRepoDiffStore().afterConflictAction(path)
  },

  async markConflictResolved(this: CommitBoxStore, path: string): Promise<void> {
    await this.runAction({ kind: 'mark-conflict-resolved', target: path }, { skipConfirm: true })
    await useRepoDiffStore().afterConflictAction(path)
  },

  stageAll(this: CommitBoxStore): void {
    void this.runAction({ kind: 'stage-all' })
  },

  unstageAll(this: CommitBoxStore): void {
    void this.runAction({ kind: 'unstage-all' })
  },

  async discardAllChanges(this: CommitBoxStore): Promise<void> {
    if (this.workingTree.length === 0) return
    if (this.stagedFiles.length > 0) {
      const ok = await this.runAction({ kind: 'unstage-all' }, { skipConfirm: true })
      if (!ok) return
    }
    await this.runAction({ kind: 'discard-all' })
  },

  async commit(this: CommitBoxStore, options: { thenPush?: boolean; forcePush?: boolean } = {}): Promise<void> {
    if (!this.canCommit) return
    const { thenPush = false, forcePush = false } = options

    let kind: GitAction['kind']
    if (thenPush && forcePush) {
      kind = 'commit-and-force-push'
    } else if (thenPush) {
      kind = 'commit-and-push'
    } else {
      kind = this.amend ? 'amend' : 'commit'
    }

    await this.runAction({
      kind,
      meta: {
        message: this.commitMessage,
        body: this.commitDescription,
        signOff: this.signOff,
        amend: this.amend,
      },
    })
    this.commitMessage = ''
    this.commitDescription = ''
    this.amend = false
  },
}
