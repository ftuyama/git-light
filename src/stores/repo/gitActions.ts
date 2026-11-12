import type { GitAction } from '@/types/git'
import type { Branch } from '@/types/git'
import { credentialHintFor } from '@shared/git/credentialHints'
import { isDestructiveAction } from '@shared/git/destructive'
import { gitService } from '@/lib/git'
import { saveBranchFavorites } from '@/lib/tauri/favorites'
import { usePromptStore } from '@/stores/prompt'
import { useRepoDiffStore } from '@/stores/repoDiff'
import { useSelectionStore, PENDING_BRANCH_ROW } from '@/stores/selection'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'
import { useGitOutputStore } from '@/stores/gitOutput'
import { mergeMetaForMode, type MergeMode } from '@/lib/mergeMode'
import { translate } from '@/locales'
import {
  describeAction,
  isBranchSwitchAction,
  labelForOperation,
  scopesForAction,
} from './actionHelpers'
import { headCommitIndex as computeHeadCommitIndex } from '@/lib/graph/pendingGraphRow'
import { suppressWatcherRefresh } from './refreshScheduler'
import type { RepositoryState } from './types'

/** Silent background fetch (auto-fetch) bookkeeping. A `setTimeout` chain
 * (not `setInterval`) so a slow fetch never overlaps the next tick. */
let autoFetchTimer: ReturnType<typeof setTimeout> | undefined
let autoFetchInFlight = false

function clearAutoFetchTimer(): void {
  if (autoFetchTimer !== undefined) {
    clearTimeout(autoFetchTimer)
    autoFetchTimer = undefined
  }
}

/** True while a silent auto-fetch is running. `lifecycle.onProgress`
 * uses this to ignore backend progress noise from background fetches. */
export function isAutoFetchInFlight(): boolean {
  return autoFetchInFlight
}

type GitActionsStore = RepositoryState & {
  inProgressOperation: boolean
  refreshSnapshot: (
    scopes?: import('@shared/git/models').SnapshotScope[],
    extra?: Pick<import('@shared/git/models').SnapshotOptions, 'invalidateCommits'>,
  ) => Promise<void>
  runAction(action: GitAction, options?: { skipConfirm?: boolean }): Promise<boolean>
  restartAutoFetch(): void
  stopAutoFetch(): void
  runAutoFetch(): Promise<void>
  checkoutBranchForIntegrate(branch: Branch): Promise<boolean>
  beginCreateBranch(options?: { startPoint?: string; sha?: string }): void
  submitBranchCreation(name: string): Promise<void>
}

export const gitActions = {
  async runAction(
    this: GitActionsStore,
    action: GitAction,
    options?: { skipConfirm?: boolean },
  ): Promise<boolean> {
    if (!options?.skipConfirm && isDestructiveAction(action.kind)) {
      // Defer until after context menus restore focus to their trigger.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
      const ok = await usePromptStore().confirm({
        title: translate('shell.prompts.confirmDestructive'),
        message: describeAction(action),
        confirmLabel: translate('shell.prompts.destructiveContinue'),
        danger: true,
      })
      if (!ok) return false
    }

    if (action.kind === 'open-terminal') {
      // No embedded terminal: always open the system terminal.
      await gitService.openTerminal(this.repository?.path)
      return true
    }

    if (action.kind === 'reveal-in-finder' && action.target && this.repository) {
      const full = action.target.startsWith('/')
        ? action.target
        : `${this.repository.path}/${action.target}`
      // Keep the resolved path inside the repo: reject parent traversal.
      const parts = full.split('/')
      const resolved: string[] = []
      for (const part of parts) {
        if (part === '..') {
          if (resolved.length === 0 || resolved[resolved.length - 1] === '..') {
            useToastStore().push(translate('shell.toasts.invalidPath'), 'error')
            return false
          }
          resolved.pop()
        } else {
          resolved.push(part)
        }
      }
      const safe = resolved.join('/')
      if (!safe.startsWith(this.repository.path)) {
        useToastStore().push(translate('shell.toasts.invalidPath'), 'error')
        return false
      }
      await gitService.revealPath(safe)
      return true
    }

    if (action.kind === 'refresh') {
      this.busyAction = 'refresh'
      this.operation = translate('shell.operations.refreshing')
      this.refreshing = true
      try {
        await this.refreshSnapshot(undefined, { invalidateCommits: true })
      } finally {
        this.refreshing = false
        this.busyAction = null
        this.operation = null
      }
      useToastStore().push(translate('shell.toasts.refreshed'), 'success')
      return true
    }

    const toast = useToastStore()
    const switchingBranch = isBranchSwitchAction(action.kind)
    this.busyAction = action.kind
    this.operation = labelForOperation(action)
    this.branchSwitching = switchingBranch
    this.canCancel = [
      'fetch',
      'pull',
      'push',
      'push-tags',
      'force-push',
      'commit-and-push',
      'commit-and-force-push',
      'sync',
      'fetch-all',
    ].includes(action.kind)

    const result = await (async () => {
      try {
        return await gitService.execute(action)
      } finally {
        this.operation = null
        this.operationPhase = null
        this.busyAction = null
        this.branchSwitching = false
        this.canCancel = false
      }
    })()

    const hint = !result.ok && result.errorCode ? credentialHintFor(result.errorCode) : undefined
    const toastMessage = hint ? `${result.message} — ${hint}` : result.message
    toast.push(toastMessage, result.ok ? 'success' : 'error')
    useGitOutputStore().log(this.repository?.path, action, result)
    if (result.ok) {
      suppressWatcherRefresh()
      this.refreshing = true
      try {
        await this.refreshSnapshot(scopesForAction(action.kind))
      } finally {
        this.refreshing = false
      }
      if (switchingBranch) {
        useSelectionStore().select(this.commits[0]?.sha ?? null)
        useRepoDiffStore().resetOnRepoClose()
      }
    } else if (this.inProgressOperation) {
      await this.refreshSnapshot(['status', 'branches'])
    }

    return result.ok
  },

  restartAutoFetch(this: GitActionsStore): void {
    clearAutoFetchTimer()
    autoFetchInFlight = false
    // No repo open, or auto-fetch disabled in settings: stay stopped.
    if (!this.repository) return
    const intervalSec = useUiStore().autoFetchIntervalSec
    if (!intervalSec || intervalSec <= 0) return
    autoFetchTimer = setTimeout(() => {
      void this.runAutoFetch()
    }, intervalSec * 1000)
  },

  stopAutoFetch(): void {
    clearAutoFetchTimer()
    autoFetchInFlight = false
  },

  async runAutoFetch(this: GitActionsStore): Promise<void> {
    autoFetchTimer = undefined
    try {
      // Single-flight, and never compete with a manual operation:
      // a manual fetch/pull/push owns the progress banner and cancel.
      if (autoFetchInFlight) return
      if (!this.repository) return
      if (this.busyAction || this.inProgressOperation || this.refreshing || this.loading) return
      autoFetchInFlight = true
      try {
        // Bypass `runAction`: no toast, no operation banner, no cancel
        // button. Progress events from this fetch are ignored by
        // `lifecycle.onProgress` (see `isAutoFetchInFlight`).
        const result = await gitService.execute({ kind: 'fetch' })
        if (result.ok) {
          await this.refreshSnapshot(scopesForAction('fetch'))
        }
        // Silent on failure (offline, auth, no upstream): the next
        // tick retries, and the watcher still picks up local changes.
      } catch (err) {
        console.error('[git-light] auto-fetch failed:', err)
      } finally {
        autoFetchInFlight = false
      }
    } finally {
      // Reschedule from the current settings so interval changes apply
      // without reopening the repo.
      if (this.repository) this.restartAutoFetch()
    }
  },

  beginCreateBranch(
    this: GitActionsStore,
    options?: { startPoint?: string; sha?: string },
  ): void {
    const selection = useSelectionStore()
    let startPoint = options?.startPoint
    let sourceSha = options?.sha

    if (startPoint && !sourceSha) {
      const branch = this.branches.find((b) => b.name === startPoint)
      sourceSha = branch?.tipSha
    }

    if (!sourceSha) {
      const headCommit = this.commits.find((c) => c.refs.some((r) => r.isHead))
      sourceSha = headCommit?.sha ?? this.commits[0]?.sha
    }

    if (!sourceSha) {
      useToastStore().push(translate('shell.toasts.noCommit'), 'error')
      return
    }

    const headIndex = computeHeadCommitIndex(this.commits, this.repository?.headSha)
    const headSha = this.commits[headIndex]?.sha
    const hasPendingChanges =
      this.workingTree.some((f) => f.staged) ||
      this.workingTree.some((f) => !f.staged && f.status !== 'conflicted') ||
      this.workingTree.some((f) => f.status === 'conflicted')
    const usePendingRow =
      hasPendingChanges &&
      headIndex >= 0 &&
      sourceSha === headSha

    const creation = {
      display: usePendingRow ? PENDING_BRANCH_ROW : sourceSha,
      startPoint: startPoint ?? (usePendingRow ? undefined : sourceSha),
    } as const

    // Defer until after context menus restore focus to their trigger.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        selection.beginBranchCreation(creation)
      })
    })
  },

  async submitBranchCreation(this: GitActionsStore, name: string): Promise<void> {
    const selection = useSelectionStore()
    const pending = selection.branchCreation
    if (!pending) return

    const trimmed = name.trim()
    if (!trimmed) return

    const { startPoint } = pending
    selection.cancelBranchCreation()

    const created = await this.runAction({
      kind: 'create-branch',
      target: trimmed,
      meta: { name: trimmed, ...(startPoint ? { startPoint } : {}) },
    })
    if (!created) return

    const onNewBranch =
      this.branches.some((b) => b.isCurrent && b.name === trimmed) ||
      this.repository?.currentBranch === trimmed
    if (!onNewBranch) {
      await this.runAction({ kind: 'checkout', target: trimmed }, { skipConfirm: true })
    }
  },

  createBranch(this: GitActionsStore, startPoint?: string): void {
    this.beginCreateBranch({ startPoint })
  },

  async renameBranch(this: GitActionsStore, branchName: string): Promise<void> {
    const newName = await usePromptStore().prompt({
      title: translate('shell.prompts.renameBranchTitle'),
      message: translate('shell.prompts.renameBranchMessage', { name: branchName }),
      defaultValue: branchName,
    })
    if (!newName || newName === branchName) return
    await this.runAction({ kind: 'rename-branch', target: branchName, meta: { newName } })
  },

  async deleteBranch(this: GitActionsStore, branchName: string, force = false): Promise<void> {
    await this.runAction({ kind: 'delete-branch', target: branchName, meta: { force } })
  },

  async deleteBranches(
    this: GitActionsStore,
    branchNames: string[],
    folder?: string,
  ): Promise<void> {
    const targets = [...new Set(branchNames.map((name) => name.trim()).filter(Boolean))]
    if (targets.length === 0) return

    // Defer until after context menus restore focus to their trigger.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve())
      })
    })
    const dialogTitle = translate('shell.prompts.deleteBranchesTitle', { count: targets.length })
    const message = folder
      ? translate('shell.prompts.deleteBranchesFolderMessage', {
          count: targets.length,
          folder,
        })
      : translate('shell.prompts.deleteBranchesMessage', { count: targets.length })
    const ok = await usePromptStore().confirm({
      title: dialogTitle,
      message,
      confirmLabel: translate('common.actions.delete'),
      danger: true,
    })
    if (!ok) return

    for (const name of targets) {
      await this.runAction(
        { kind: 'delete-branch', target: name, meta: { force: false } },
        { skipConfirm: true },
      )
    }
  },

  async setUpstream(this: GitActionsStore, branchName: string): Promise<void> {
    const upstream = await usePromptStore().prompt({
      title: translate('shell.prompts.setUpstreamTitle'),
      message: translate('shell.prompts.setUpstreamMessage', { name: branchName }),
      placeholder: 'origin/main',
    })
    if (!upstream) return
    await this.runAction({ kind: 'set-upstream', target: upstream })
  },

  async mergeBranch(this: GitActionsStore, mergeMode: MergeMode = 'default'): Promise<void> {
    const target = await usePromptStore().prompt({
      title: translate('shell.prompts.mergeTitle'),
      message: translate('shell.prompts.mergeMessage'),
      placeholder: 'feature/my-branch',
    })
    if (!target) return
    await this.runAction({ kind: 'merge', target, meta: mergeMetaForMode(mergeMode) })
  },

  async rebaseOnto(this: GitActionsStore): Promise<void> {
    const target = await usePromptStore().prompt({
      title: translate('shell.prompts.rebaseTitle'),
      message: translate('shell.prompts.rebaseMessage'),
      placeholder: 'main',
    })
    if (!target) return
    await this.runAction({ kind: 'rebase', target })
  },

  async integrateBranches(
    this: GitActionsStore,
    source: Branch,
    target: Branch,
    mode: 'merge' | 'rebase',
    mergeMode: MergeMode = 'default',
  ): Promise<void> {
    if (source.id === target.id) return

    if (this.busyAction || this.inProgressOperation) {
      useToastStore().push(translate('shell.toasts.operationInProgress'), 'error')
      return
    }

    if (mode === 'merge') {
      if (!target.isCurrent) {
        const switched = await this.checkoutBranchForIntegrate(target)
        if (!switched) return
      }
      await this.runAction({
        kind: 'merge',
        target: source.name,
        meta: mergeMetaForMode(mergeMode),
      })
      return
    }

    if (!source.isCurrent) {
      const switched = await this.checkoutBranchForIntegrate(source)
      if (!switched) return
    }
    await this.runAction({ kind: 'rebase', target: target.name })
  },

  async checkoutBranchForIntegrate(this: GitActionsStore, branch: Branch): Promise<boolean> {
    if (branch.kind === 'remote') {
      const localName = branch.name.includes('/')
        ? branch.name.split('/').slice(1).join('/')
        : branch.name
      return this.runAction({
        kind: 'checkout',
        target: localName,
        meta: { remote: branch.remote },
      })
    }
    return this.runAction({ kind: 'checkout', target: branch.name })
  },

  async cherryPickCommit(this: GitActionsStore, sha?: string): Promise<void> {
    const target =
      sha ??
      (await usePromptStore().prompt({
        title: translate('shell.prompts.cherryPickTitle'),
        message: translate('shell.prompts.cherryPickMessage'),
        placeholder: 'abc1234',
      }))
    if (!target) return
    await this.runAction({ kind: 'cherry-pick', target })
  },

  async resetTo(this: GitActionsStore, mode: 'reset-soft' | 'reset-mixed' | 'reset-hard', sha?: string): Promise<void> {
    const target =
      sha ??
      (await usePromptStore().prompt({
        title: translate('shell.prompts.resetTitle'),
        message: translate('shell.prompts.resetMessage'),
        placeholder: 'HEAD~1',
      }))
    await this.runAction({ kind: mode, target: target || 'HEAD' })
  },

  async stashChanges(this: GitActionsStore): Promise<void> {
    const message = await usePromptStore().prompt({
      title: translate('shell.prompts.stashTitle'),
      message: translate('shell.prompts.stashMessage'),
      defaultValue: 'WIP',
    })
    if (message === null) return
    await this.runAction({ kind: 'stash', meta: { message: message || 'WIP' } })
  },

  async renameStash(this: GitActionsStore, target: string, currentMessage: string): Promise<void> {
    const message = await usePromptStore().prompt({
      title: translate('shell.prompts.renameStashTitle'),
      message: translate('shell.prompts.renameStashMessage'),
      defaultValue: currentMessage,
    })
    if (message === null || message.trim() === '') return
    await this.runAction({ kind: 'rename-stash', target, meta: { message: message.trim() } })
  },

  async createTag(this: GitActionsStore): Promise<void> {
    const name = await usePromptStore().prompt({
      title: translate('shell.prompts.createTagTitle'),
      message: translate('shell.prompts.tagNameMessage'),
      placeholder: 'v1.0.0',
    })
    if (!name) return
    const message = await usePromptStore().prompt({
      title: translate('shell.prompts.tagMessageTitle'),
      message: translate('shell.prompts.tagMessageMessage'),
      placeholder: name,
    })
    await this.runAction({
      kind: 'create-tag',
      meta: { name, message: message ?? name, annotated: Boolean(message) },
    })
  },

  async createTagAt(this: GitActionsStore, sha: string): Promise<void> {
    const name = await usePromptStore().prompt({
      title: translate('shell.prompts.createTagTitle'),
      message: translate('shell.prompts.tagNameForSha', { sha: sha.slice(0, 7) }),
      placeholder: 'v1.0.0',
    })
    if (!name) return
    const message = await usePromptStore().prompt({
      title: translate('shell.prompts.tagMessageTitle'),
      message: translate('shell.prompts.tagMessageMessage'),
      placeholder: name,
    })
    await this.runAction({
      kind: 'create-tag',
      meta: { name, message: message ?? name, annotated: Boolean(message), sha },
    })
  },

  async addWorktree(this: GitActionsStore, defaultBranch?: string): Promise<void> {
    const path = await usePromptStore().prompt({
      title: translate('shell.prompts.addWorktreeTitle'),
      message: translate('shell.prompts.worktreePathMessage'),
      placeholder: '../my-repo-feature',
    })
    if (!path) return
    const branch = await usePromptStore().prompt({
      title: translate('shell.prompts.worktreeBranchTitle'),
      message: translate('shell.prompts.worktreeBranchMessage'),
      placeholder: 'feature/my-branch',
      ...(defaultBranch ? { defaultValue: defaultBranch } : {}),
    })
    await this.runAction({
      kind: 'worktree-add',
      meta: { path, ...(branch ? { branch } : {}) },
    })
  },

  async removeWorktree(this: GitActionsStore, worktreePath: string): Promise<void> {
    await this.runAction({ kind: 'worktree-remove', target: worktreePath })
  },

  async continueOperation(this: GitActionsStore): Promise<void> {
    const s = this.repository?.state
    if (s?.merging) await this.runAction({ kind: 'merge-continue' }, { skipConfirm: true })
    else if (s?.rebasing) await this.runAction({ kind: 'rebase-continue' }, { skipConfirm: true })
    else if (s?.cherryPicking) await this.runAction({ kind: 'cherry-pick-continue' }, { skipConfirm: true })
    else if (s?.reverting) await this.runAction({ kind: 'revert-continue' }, { skipConfirm: true })
  },

  async abortOperation(this: GitActionsStore): Promise<void> {
    const s = this.repository?.state
    if (s?.merging) await this.runAction({ kind: 'merge-abort' }, { skipConfirm: true })
    else if (s?.rebasing) await this.runAction({ kind: 'rebase-abort' }, { skipConfirm: true })
    else if (s?.cherryPicking) await this.runAction({ kind: 'cherry-pick-abort' }, { skipConfirm: true })
    else if (s?.reverting) await this.runAction({ kind: 'revert-abort' }, { skipConfirm: true })
  },

  async skipRebaseOperation(this: GitActionsStore): Promise<void> {
    if (!this.repository?.state?.rebasing) return
    await this.runAction({ kind: 'rebase-skip' }, { skipConfirm: true })
  },

  async startBisect(this: GitActionsStore): Promise<void> {
    if (this.busyAction || this.inProgressOperation) {
      useToastStore().push(translate('shell.toasts.operationInProgress'), 'error')
      return
    }
    const bad = await usePromptStore().prompt({
      title: translate('shell.prompts.bisectTitle'),
      message: translate('shell.prompts.bisectBadMessage'),
      placeholder: 'HEAD',
    })
    if (bad === null) return
    const good = await usePromptStore().prompt({
      title: translate('shell.prompts.bisectTitle'),
      message: translate('shell.prompts.bisectGoodMessage'),
      placeholder: 'v1.0.0',
    })
    if (good === null) return
    await this.runAction({
      kind: 'bisect-start',
      meta: { bad: bad || 'HEAD', ...(good ? { good } : {}) },
    })
  },

  async bisectGood(this: GitActionsStore, sha?: string): Promise<void> {
    await this.runAction({ kind: 'bisect-good', ...(sha ? { target: sha } : {}) }, { skipConfirm: true })
  },

  async bisectBad(this: GitActionsStore, sha?: string): Promise<void> {
    await this.runAction({ kind: 'bisect-bad', ...(sha ? { target: sha } : {}) }, { skipConfirm: true })
  },

  async bisectSkip(this: GitActionsStore): Promise<void> {
    await this.runAction({ kind: 'bisect-skip' }, { skipConfirm: true })
  },

  async bisectReset(this: GitActionsStore): Promise<void> {
    await this.runAction({ kind: 'bisect-reset' }, { skipConfirm: true })
  },

  async lfsTrack(this: GitActionsStore): Promise<void> {
    const pattern = await usePromptStore().prompt({
      title: translate('shell.prompts.lfsTrackTitle'),
      message: translate('shell.prompts.lfsTrackMessage'),
      placeholder: '*.zip',
    })
    if (!pattern) return
    await this.runAction({ kind: 'lfs-track', target: pattern.trim() })
  },

  async lfsUntrack(this: GitActionsStore): Promise<void> {
    const pattern = await usePromptStore().prompt({
      title: translate('shell.prompts.lfsUntrackTitle'),
      message: translate('shell.prompts.lfsUntrackMessage'),
      placeholder: '*.zip',
    })
    if (!pattern) return
    await this.runAction({ kind: 'lfs-untrack', target: pattern.trim() })
  },

  async lfsPrune(this: GitActionsStore): Promise<void> {
    await this.runAction({ kind: 'lfs-prune' })
  },

  toggleFavorite(this: GitActionsStore, branchId: string): void {
    const branch = this.branches.find((b) => b.id === branchId)
    if (!branch || !this.repository) return
    branch.isFavorite = !branch.isFavorite
    const favorites = this.branches.filter((b) => b.isFavorite).map((b) => b.name)
    void saveBranchFavorites(this.repository.path, favorites)
  },

  checkoutBranch(this: GitActionsStore, name: string): void {
    void this.runAction({ kind: 'checkout', target: name })
  },

  checkoutRemoteBranch(this: GitActionsStore, branch: Branch): void {
    const localName = branch.name.includes('/') ? branch.name.split('/').slice(1).join('/') : branch.name
    void this.runAction({ kind: 'checkout', target: localName, meta: { remote: branch.remote } })
  },
}
