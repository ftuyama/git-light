import type { ActionResult, GitAction, GitActionKind, RepositoryData } from '@/types/git'
import { generateAwesomeShop } from '@/data/generateAwesomeShop'
import type { GitService } from './GitService'

const ACTION_MESSAGES: Record<GitActionKind, (target?: string) => string> = {
  fetch: () => 'Fetched from origin',
  pull: () => 'Pulled latest changes from origin',
  push: () => 'Pushed commits to origin',
  'force-push': () => 'Force-pushed to origin',
  sync: () => 'Synced with origin',
  stash: () => 'Saved working tree to stash',
  'pop-stash': () => 'Popped latest stash',
  'apply-stash': () => 'Applied stash',
  'drop-stash': () => 'Dropped stash',
  'cherry-pick': (t) => `Cherry-picked ${t ?? 'commit'}`,
  merge: (t) => `Merged ${t ?? 'branch'}`,
  rebase: (t) => `Rebased onto ${t ?? 'branch'}`,
  'interactive-rebase': () => 'Started interactive rebase',
  'reset-soft': (t) => `Soft reset to ${t ?? 'commit'}`,
  'reset-mixed': (t) => `Mixed reset to ${t ?? 'commit'}`,
  'reset-hard': (t) => `Hard reset to ${t ?? 'commit'}`,
  revert: (t) => `Reverted ${t ?? 'commit'}`,
  undo: () => 'Undid last operation',
  redo: () => 'Redid operation',
  refresh: () => 'Refreshed repository',
  'open-terminal': () => 'Opened terminal',
  checkout: (t) => `Checked out ${t ?? 'branch'}`,
  'create-branch': (t) => `Created branch ${t ?? ''}`.trim(),
  'delete-branch': (t) => `Deleted branch ${t ?? ''}`.trim(),
  'rename-branch': (t) => `Renamed branch ${t ?? ''}`.trim(),
  'compare-branches': () => 'Comparing branches',
  tag: (t) => `Tagged ${t ?? 'commit'}`,
  'copy-sha': () => 'Copied SHA to clipboard',
  'open-on-github': () => 'Opened on GitHub',
  'rebase-from-here': (t) => `Rebasing from ${t ?? 'commit'}`,
  'stage-all': () => 'Staged all changes',
  'unstage-all': () => 'Unstaged all changes',
  stage: (t) => `Staged ${t ?? 'file'}`,
  unstage: (t) => `Unstaged ${t ?? 'file'}`,
  commit: () => 'Created commit',
  'commit-and-push': () => 'Committed and pushed',
}

/**
 * In-memory implementation backed by generated data. Actions resolve after a
 * short delay to mimic real latency so the UI can show progress states.
 */
export class MockGitService implements GitService {
  private data: RepositoryData | null = null

  async load(): Promise<RepositoryData> {
    await delay(280)
    if (!this.data) this.data = generateAwesomeShop(400)
    return this.data
  }

  async execute(action: GitAction): Promise<ActionResult> {
    // Forward to the (stubbed) main process so the IPC contract is exercised.
    try {
      await window.electron?.git.action(action)
    } catch {
      // The renderer also runs in a plain browser during tests; ignore.
    }
    await delay(latencyFor(action.kind))
    const message = ACTION_MESSAGES[action.kind]?.(action.target) ?? `Ran ${action.kind}`
    return { ok: true, message }
  }
}

function latencyFor(kind: GitActionKind): number {
  if (kind === 'fetch' || kind === 'pull' || kind === 'sync') return 900
  if (kind === 'push' || kind === 'force-push' || kind === 'commit-and-push') return 1100
  if (kind === 'copy-sha' || kind === 'undo' || kind === 'redo') return 120
  return 360
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const gitService: GitService = new MockGitService()
