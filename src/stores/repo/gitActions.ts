import type { GitAction } from '@/types/git'
import type { Branch } from '@/types/git'
import { credentialHintFor } from '@shared/git/credentialHints'
import { isDestructiveAction } from '@shared/git/destructive'
import { gitService } from '@/lib/git'
import { usePromptStore } from '@/stores/prompt'
import { useRepoDiffStore } from '@/stores/repoDiff'
import { useSelectionStore } from '@/stores/selection'
import { useToastStore } from '@/stores/toast'
import {
  describeAction,
  isBranchSwitchAction,
  labelForOperation,
  scopesForAction,
} from './actionHelpers'
import { suppressWatcherRefresh } from './refreshScheduler'
import type { RepositoryState } from './types'

type GitActionsStore = RepositoryState & {
  inProgressOperation: boolean
  refreshSnapshot: (
    scopes?: import('@shared/git/models').SnapshotScope[],
    extra?: Pick<import('@shared/git/models').SnapshotOptions, 'invalidateCommits'>,
  ) => Promise<void>
  runAction(action: GitAction, options?: { skipConfirm?: boolean }): Promise<boolean>
  checkoutBranchForIntegrate(branch: Branch): Promise<boolean>
}

export const gitActions = {
  async runAction(
    this: GitActionsStore,
    action: GitAction,
    options?: { skipConfirm?: boolean },
  ): Promise<boolean> {
    if (!options?.skipConfirm && isDestructiveAction(action.kind)) {
      const ok = await usePromptStore().confirm({
        title: 'Confirm destructive action',
        message: describeAction(action),
        confirmLabel: 'Continue',
        danger: true,
      })
      if (!ok) return false
    }

    if (action.kind === 'open-terminal') {
      const opened = await gitService.openTerminal(this.repository?.path)
      useToastStore().push(opened ? 'Opened terminal' : 'Could not open terminal', opened ? 'success' : 'error')
      return opened
    }

    if (action.kind === 'reveal-in-finder' && action.target && this.repository) {
      const full = action.target.startsWith('/')
        ? action.target
        : `${this.repository.path}/${action.target}`
      await gitService.revealPath(full)
      return true
    }

    if (action.kind === 'refresh') {
      this.busyAction = 'refresh'
      this.operation = 'Refreshing...'
      this.refreshing = true
      try {
        await this.refreshSnapshot(undefined, { invalidateCommits: true })
      } finally {
        this.refreshing = false
        this.busyAction = null
        this.operation = null
      }
      useToastStore().push('Refreshed repository', 'success')
      return true
    }

    const toast = useToastStore()
    const switchingBranch = isBranchSwitchAction(action.kind)
    this.busyAction = action.kind
    this.operation = labelForOperation(action)
    this.branchSwitching = switchingBranch
    this.canCancel = ['fetch', 'pull', 'push', 'force-push', 'commit-and-force-push', 'sync', 'fetch-all'].includes(action.kind)

    const result = await gitService.execute(action)

    const hint = !result.ok && result.errorCode ? credentialHintFor(result.errorCode) : undefined
    const toastMessage = hint ? `${result.message} — ${hint}` : result.message
    toast.push(toastMessage, result.ok ? 'success' : 'error')
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

    this.operation = null
    this.operationPhase = null
    this.busyAction = null
    this.branchSwitching = false
    this.canCancel = false
    return result.ok
  },

  async createBranch(this: GitActionsStore, startPoint?: string): Promise<void> {
    const name = await usePromptStore().prompt({
      title: 'Create Branch',
      message: startPoint ? `Branch from ${startPoint}` : 'Enter a name for the new branch',
      placeholder: 'feature/my-branch',
    })
    if (!name) return
    await this.runAction({ kind: 'create-branch', meta: { name, startPoint } })
  },

  async renameBranch(this: GitActionsStore, branchName: string): Promise<void> {
    const newName = await usePromptStore().prompt({
      title: 'Rename Branch',
      message: `Rename ${branchName}`,
      defaultValue: branchName,
    })
    if (!newName || newName === branchName) return
    await this.runAction({ kind: 'rename-branch', target: branchName, meta: { newName } })
  },

  async deleteBranch(this: GitActionsStore, branchName: string, force = false): Promise<void> {
    await this.runAction({ kind: 'delete-branch', target: branchName, meta: { force } })
  },

  async setUpstream(this: GitActionsStore, branchName: string): Promise<void> {
    const upstream = await usePromptStore().prompt({
      title: 'Set Upstream',
      message: `Upstream for ${branchName}`,
      placeholder: 'origin/main',
    })
    if (!upstream) return
    await this.runAction({ kind: 'set-upstream', target: upstream })
  },

  async mergeBranch(this: GitActionsStore): Promise<void> {
    const target = await usePromptStore().prompt({
      title: 'Merge Branch',
      message: 'Branch to merge into the current branch',
      placeholder: 'feature/my-branch',
    })
    if (!target) return
    await this.runAction({ kind: 'merge', target })
  },

  async rebaseOnto(this: GitActionsStore): Promise<void> {
    const target = await usePromptStore().prompt({
      title: 'Rebase',
      message: 'Rebase current branch onto',
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
  ): Promise<void> {
    if (source.id === target.id) return

    if (this.busyAction || this.inProgressOperation) {
      useToastStore().push('Finish the current operation first', 'error')
      return
    }

    if (mode === 'merge') {
      if (!target.isCurrent) {
        const switched = await this.checkoutBranchForIntegrate(target)
        if (!switched) return
      }
      await this.runAction({ kind: 'merge', target: source.name })
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
        title: 'Cherry Pick',
        message: 'Commit SHA to cherry-pick',
        placeholder: 'abc1234',
      }))
    if (!target) return
    await this.runAction({ kind: 'cherry-pick', target })
  },

  async resetTo(this: GitActionsStore, mode: 'reset-soft' | 'reset-mixed' | 'reset-hard', sha?: string): Promise<void> {
    const target =
      sha ??
      (await usePromptStore().prompt({
        title: 'Reset',
        message: 'Commit to reset to (leave empty for HEAD)',
        placeholder: 'HEAD~1',
      }))
    await this.runAction({ kind: mode, target: target || 'HEAD' })
  },

  async stashChanges(this: GitActionsStore): Promise<void> {
    const message = await usePromptStore().prompt({
      title: 'Stash Changes',
      message: 'Optional stash message',
      defaultValue: 'WIP',
    })
    if (message === null) return
    await this.runAction({ kind: 'stash', meta: { message: message || 'WIP' } })
  },

  async createTag(this: GitActionsStore): Promise<void> {
    const name = await usePromptStore().prompt({
      title: 'Create Tag',
      message: 'Tag name',
      placeholder: 'v1.0.0',
    })
    if (!name) return
    const message = await usePromptStore().prompt({
      title: 'Tag Message',
      message: 'Annotated tag message (optional)',
      placeholder: name,
    })
    await this.runAction({
      kind: 'create-tag',
      meta: { name, message: message ?? name, annotated: Boolean(message) },
    })
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

  toggleFavorite(this: GitActionsStore, branchId: string): void {
    const branch = this.branches.find((b) => b.id === branchId)
    if (!branch || !this.repository) return
    branch.isFavorite = !branch.isFavorite
    const key = `branch-favorites:${this.repository.path}`
    const favorites = this.branches.filter((b) => b.isFavorite).map((b) => b.name)
    void window.electron?.store.set(key, favorites)
  },

  checkoutBranch(this: GitActionsStore, name: string): void {
    void this.runAction({ kind: 'checkout', target: name })
  },

  checkoutRemoteBranch(this: GitActionsStore, branch: Branch): void {
    const localName = branch.name.includes('/') ? branch.name.split('/').slice(1).join('/') : branch.name
    void this.runAction({ kind: 'checkout', target: localName, meta: { remote: branch.remote } })
  },
}
