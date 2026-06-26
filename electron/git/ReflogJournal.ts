import type { RepoState } from '@shared/git/models'
import { GitError } from '@shared/git/errors'
import { gitCli } from './GitCliProvider'
import type { JournalCapture } from '@shared/git/undoPolicy'

export interface JournalCheckpoint {
  headSha: string
  branch: string
  indexTreeSha: string | null
}

export interface JournalEntry extends JournalCheckpoint {
  label: string
}

export interface JournalState {
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | null
  redoLabel: string | null
}

export function isUndoRedoSafe(state: RepoState): boolean {
  return !state.merging && !state.rebasing && !state.cherryPicking && !state.reverting
}

export class ReflogJournal {
  private undoStack: JournalEntry[] = []
  private redoStack: JournalEntry[] = []

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }

  getState(repoState: RepoState): JournalState {
    const safe = isUndoRedoSafe(repoState)
    return {
      canUndo: safe && this.undoStack.length > 0,
      canRedo: safe && this.redoStack.length > 0,
      undoLabel: safe ? (this.undoStack.at(-1)?.label ?? null) : null,
      redoLabel: safe ? (this.redoStack.at(-1)?.label ?? null) : null,
    }
  }

  pushUndo(checkpoint: JournalCheckpoint, label: string): void {
    this.undoStack.push({ ...checkpoint, label })
    this.redoStack = []
  }

  async capture(
    cwd: string,
    capture: JournalCapture,
    signal?: AbortSignal,
  ): Promise<JournalCheckpoint> {
    const headResult = await gitCli.run(['rev-parse', 'HEAD'], { cwd, signal, allowFailure: true })
    const branchResult = await gitCli.run(['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      signal,
      allowFailure: true,
    })
    const headSha = headResult.stdout.trim()
    if (!headSha) {
      throw new GitError('Unknown', 'Could not read HEAD.')
    }

    let indexTreeSha: string | null = null
    if (capture === 'index') {
      const treeResult = await gitCli.run(['write-tree'], { cwd, signal, allowFailure: true })
      indexTreeSha = treeResult.stdout.trim() || null
    }

    return {
      headSha,
      branch: branchResult.stdout.trim() || 'HEAD',
      indexTreeSha,
    }
  }

  async undo(cwd: string, signal?: AbortSignal): Promise<string> {
    const entry = this.undoStack.pop()
    if (!entry) {
      throw new GitError('Unknown', 'Nothing to undo.')
    }

    const current = await this.capture(
      cwd,
      entry.indexTreeSha ? 'index' : 'head',
      signal,
    )
    this.redoStack.push({ ...current, label: entry.label })

    await this.restore(cwd, entry, signal)
    return `Undid ${entry.label}`
  }

  async redo(cwd: string, signal?: AbortSignal): Promise<string> {
    const entry = this.redoStack.pop()
    if (!entry) {
      throw new GitError('Unknown', 'Nothing to redo.')
    }

    const current = await this.capture(
      cwd,
      entry.indexTreeSha ? 'index' : 'head',
      signal,
    )
    this.undoStack.push({ ...current, label: entry.label })

    await this.restore(cwd, entry, signal)
    return `Redid ${entry.label}`
  }

  private async restore(
    cwd: string,
    entry: JournalCheckpoint,
    signal?: AbortSignal,
  ): Promise<void> {
    if (entry.indexTreeSha && entry.headSha === (await this.currentHead(cwd, signal))) {
      await gitCli.run(['read-tree', entry.indexTreeSha], { cwd, signal })
      return
    }

    if (entry.branch && entry.branch !== 'HEAD') {
      const checkout = await gitCli.run(['checkout', entry.branch], {
        cwd,
        signal,
        allowFailure: true,
      })
      if (checkout.exitCode === 0) {
        await gitCli.run(['reset', '--hard', entry.headSha], { cwd, signal })
        if (entry.indexTreeSha) {
          await gitCli.run(['read-tree', entry.indexTreeSha], { cwd, signal })
        }
        return
      }
    }

    await gitCli.run(['checkout', '--detach', entry.headSha], { cwd, signal })
    if (entry.indexTreeSha) {
      await gitCli.run(['read-tree', entry.indexTreeSha], { cwd, signal })
    }
  }

  private async currentHead(cwd: string, signal?: AbortSignal): Promise<string> {
    const { stdout } = await gitCli.run(['rev-parse', 'HEAD'], { cwd, signal })
    return stdout.trim()
  }
}
