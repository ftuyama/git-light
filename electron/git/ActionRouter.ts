import type { GitAction } from '@shared/git/actions'
import type { ActionEnvelope } from '@shared/git/models'
import { GitError } from '@shared/git/errors'
import { gitCli } from './GitCliProvider'
import { assertPathInsideRepo } from './pathUtils'

export interface ActionContext {
  cwd: string
  signal?: AbortSignal
  onProgress?: (phase: string, percent: number | null) => void
}

const DESTRUCTIVE = new Set([
  'reset-hard',
  'force-push',
  'delete-branch',
  'delete-remote-branch',
  'drop-stash',
  'discard-file',
  'discard-all',
])

export function isDestructiveAction(kind: string): boolean {
  return DESTRUCTIVE.has(kind)
}

export async function executeGitAction(
  action: GitAction,
  ctx: ActionContext,
): Promise<ActionEnvelope> {
  try {
    const message = await routeAction(action, ctx)
    return { ok: true, message }
  } catch (error) {
    if (error instanceof GitError) {
      return {
        ok: false,
        message: error.message,
        error: error.serialize(),
        conflicts: error.files,
      }
    }
    const msg = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      message: msg,
      error: new GitError('Unknown', msg).serialize(),
    }
  }
}

async function routeAction(action: GitAction, ctx: ActionContext): Promise<string> {
  const { cwd, signal, onProgress } = ctx
  const target = action.target
  const meta = action.meta ?? {}

  switch (action.kind) {
    case 'fetch':
      await gitCli.runStreaming(['fetch', '--all'], { cwd, signal }, (line) =>
        onProgress?.(line, null),
      )
      return 'Fetched from all remotes'
    case 'fetch-all':
      await gitCli.runStreaming(['fetch', '--all', '--prune'], { cwd, signal }, (line) =>
        onProgress?.(line, null),
      )
      return 'Fetched and pruned remotes'
    case 'pull':
      await gitCli.run(['pull', '--ff-only'], { cwd, signal })
      return 'Pulled latest changes'
    case 'push':
      await gitCli.runStreaming(['push'], { cwd, signal }, (line) => onProgress?.(line, null))
      return 'Pushed to remote'
    case 'force-push':
      await gitCli.runStreaming(['push', '--force-with-lease'], { cwd, signal }, (line) =>
        onProgress?.(line, null),
      )
      return 'Force-pushed to remote'
    case 'push-tags':
      await gitCli.run(['push', '--tags'], { cwd, signal })
      return 'Pushed tags'
    case 'prune':
      await gitCli.run(['remote', 'prune', 'origin'], { cwd, signal })
      return 'Pruned stale remote branches'
    case 'sync': {
      await gitCli.runStreaming(['fetch', '--all'], { cwd, signal }, (line) =>
        onProgress?.(line, null),
      )
      await gitCli.run(['pull', '--ff-only'], { cwd, signal })
      return 'Synced with remote'
    }

    case 'stash': {
      const msg = typeof meta.message === 'string' ? meta.message : 'WIP'
      const args = ['stash', 'push', '-m', msg]
      if (meta.includeUntracked) args.push('-u')
      if (meta.keepIndex) args.push('-k')
      await gitCli.run(args, { cwd, signal })
      return 'Saved working tree to stash'
    }
    case 'pop-stash':
      await gitCli.run(['stash', 'pop', target ?? 'stash@{0}'], { cwd, signal })
      return 'Popped stash'
    case 'apply-stash':
      await gitCli.run(['stash', 'apply', target ?? 'stash@{0}'], { cwd, signal })
      return 'Applied stash'
    case 'drop-stash':
      await gitCli.run(['stash', 'drop', target ?? 'stash@{0}'], { cwd, signal })
      return 'Dropped stash'
    case 'rename-stash':
      await gitCli.run(['stash', 'store', '-m', String(meta.message ?? ''), target ?? 'stash@{0}'], {
        cwd,
        signal,
      })
      return 'Renamed stash'

    case 'stage':
      if (!target) throw new GitError('Unknown', 'No file specified.')
      await gitCli.run(['add', '--', assertPathInsideRepo(cwd, target)], { cwd, signal })
      return `Staged ${target}`
    case 'unstage':
      if (!target) throw new GitError('Unknown', 'No file specified.')
      await gitCli.run(['restore', '--staged', '--', assertPathInsideRepo(cwd, target)], {
        cwd,
        signal,
      })
      return `Unstaged ${target}`
    case 'stage-all':
      await gitCli.run(['add', '-A'], { cwd, signal })
      return 'Staged all changes'
    case 'unstage-all':
      await gitCli.run(['restore', '--staged', '.'], { cwd, signal })
      return 'Unstaged all changes'
    case 'discard-file':
      if (!target) throw new GitError('Unknown', 'No file specified.')
      await gitCli.run(['checkout', '--', assertPathInsideRepo(cwd, target)], { cwd, signal })
      return `Discarded changes in ${target}`
    case 'discard-all':
      await gitCli.run(['checkout', '--', '.'], { cwd, signal })
      return 'Discarded all unstaged changes'

    case 'commit': {
      const title = String(meta.message ?? '').trim()
      if (!title) throw new GitError('NothingToCommit', 'Commit message is required.')
      const args = ['commit', '-m', title]
      const body = typeof meta.body === 'string' ? meta.body.trim() : ''
      if (body) args.push('-m', body)
      if (meta.signOff) args.push('--signoff')
      await gitCli.run(args, { cwd, signal })
      return 'Created commit'
    }
    case 'amend': {
      const title = String(meta.message ?? '').trim()
      const args = ['commit', '--amend', '--no-edit']
      if (title) {
        args.length = 0
        args.push('commit', '--amend', '-m', title)
        const body = typeof meta.body === 'string' ? meta.body.trim() : ''
        if (body) args.push('-m', body)
      }
      if (meta.signOff) args.push('--signoff')
      await gitCli.run(args, { cwd, signal })
      return 'Amended commit'
    }
    case 'commit-and-push': {
      await routeAction({ kind: 'commit', meta }, ctx)
      await routeAction({ kind: 'push' }, ctx)
      return 'Committed and pushed'
    }

    case 'checkout':
      if (!target) throw new GitError('Unknown', 'No branch specified.')
      if (meta.remote) {
        const remoteRef = `${String(meta.remote)}/${target}`
        await gitCli.run(['checkout', '-b', target, remoteRef], { cwd, signal })
      } else {
        await gitCli.run(['checkout', target], { cwd, signal })
      }
      return `Checked out ${target}`
    case 'checkout-commit':
      if (!target) throw new GitError('Unknown', 'No commit specified.')
      await gitCli.run(['checkout', '--detach', target], { cwd, signal })
      return `Checked out ${target.slice(0, 7)} (detached HEAD)`
    case 'create-branch': {
      const name = String(meta.name ?? target ?? '').trim()
      if (!name) throw new GitError('Unknown', 'Branch name is required.')
      const start = typeof meta.startPoint === 'string' ? meta.startPoint : undefined
      await gitCli.run(start ? ['branch', name, start] : ['branch', name], { cwd, signal })
      return `Created branch ${name}`
    }
    case 'rename-branch': {
      const newName = String(meta.newName ?? meta.name ?? '').trim()
      if (!target || !newName) throw new GitError('Unknown', 'Branch names required.')
      await gitCli.run(['branch', '-m', target, newName], { cwd, signal })
      return `Renamed branch to ${newName}`
    }
    case 'delete-branch':
      if (!target) throw new GitError('Unknown', 'No branch specified.')
      await gitCli.run(meta.force ? ['branch', '-D', target] : ['branch', '-d', target], {
        cwd,
        signal,
      })
      return `Deleted branch ${target}`
    case 'delete-remote-branch':
      if (!target) throw new GitError('Unknown', 'No remote branch specified.')
      await gitCli.run(['push', 'origin', '--delete', target], { cwd, signal })
      return `Deleted remote branch ${target}`
    case 'set-upstream':
      if (!target) throw new GitError('Unknown', 'No upstream specified.')
      await gitCli.run(['branch', '-u', target], { cwd, signal })
      return `Set upstream to ${target}`
    case 'compare-branches': {
      if (!target || !meta.other) throw new GitError('Unknown', 'Two branches required.')
      const { stdout } = await gitCli.run(
        ['log', '--oneline', `${target}..${String(meta.other)}`],
        { cwd, signal, allowFailure: true },
      )
      const count = stdout.split('\n').filter(Boolean).length
      return `${count} commits in ${meta.other} not in ${target}`
    }

    case 'merge': {
      if (!target) throw new GitError('Unknown', 'No branch to merge.')
      const ff = meta.ffOnly ? ['--ff-only'] : meta.noFf ? ['--no-ff'] : meta.squash ? ['--squash'] : []
      await gitCli.run(['merge', ...ff, target], { cwd, signal })
      return `Merged ${target}`
    }
    case 'merge-continue':
      await gitCli.run(['commit', '--no-edit'], { cwd, signal })
      return 'Merge completed'
    case 'merge-abort':
      await gitCli.run(['merge', '--abort'], { cwd, signal })
      return 'Merge aborted'

    case 'rebase':
      if (!target) throw new GitError('Unknown', 'No upstream specified.')
      await gitCli.run(['rebase', target], { cwd, signal })
      return `Rebased onto ${target}`
    case 'rebase-from-here':
      if (!target) throw new GitError('Unknown', 'No commit specified.')
      await gitCli.run(['rebase', '--onto', target, 'HEAD~1'], { cwd, signal })
      return 'Rebased from commit'
    case 'interactive-rebase':
      if (!target) throw new GitError('Unknown', 'No base specified.')
      await gitCli.run(['rebase', '-i', target], { cwd, signal, env: { GIT_EDITOR: 'true' } })
      return 'Interactive rebase started'
    case 'rebase-continue':
      await gitCli.run(['rebase', '--continue'], { cwd, signal })
      return 'Rebase continued'
    case 'rebase-abort':
      await gitCli.run(['rebase', '--abort'], { cwd, signal })
      return 'Rebase aborted'
    case 'rebase-skip':
      await gitCli.run(['rebase', '--skip'], { cwd, signal })
      return 'Rebase skipped commit'

    case 'cherry-pick':
      if (!target) throw new GitError('Unknown', 'No commit specified.')
      await gitCli.run(['cherry-pick', target], { cwd, signal })
      return `Cherry-picked ${target.slice(0, 7)}`
    case 'cherry-pick-continue':
      await gitCli.run(['cherry-pick', '--continue'], { cwd, signal })
      return 'Cherry-pick continued'
    case 'cherry-pick-abort':
      await gitCli.run(['cherry-pick', '--abort'], { cwd, signal })
      return 'Cherry-pick aborted'

    case 'reset-soft':
      await gitCli.run(['reset', '--soft', target ?? 'HEAD'], { cwd, signal })
      return 'Soft reset complete'
    case 'reset-mixed':
      await gitCli.run(['reset', '--mixed', target ?? 'HEAD'], { cwd, signal })
      return 'Mixed reset complete'
    case 'reset-hard':
      await gitCli.run(['reset', '--hard', target ?? 'HEAD'], { cwd, signal })
      return 'Hard reset complete'

    case 'revert':
      if (!target) throw new GitError('Unknown', 'No commit specified.')
      await gitCli.run(['revert', '--no-edit', target], { cwd, signal })
      return `Reverted ${target.slice(0, 7)}`
    case 'revert-continue':
      await gitCli.run(['revert', '--continue'], { cwd, signal })
      return 'Revert continued'
    case 'revert-abort':
      await gitCli.run(['revert', '--abort'], { cwd, signal })
      return 'Revert aborted'

    case 'create-tag': {
      const name = String(meta.name ?? target ?? '').trim()
      if (!name) throw new GitError('Unknown', 'Tag name required.')
      const args = meta.annotated
        ? ['tag', '-a', name, '-m', String(meta.message ?? name)]
        : ['tag', name]
      if (meta.sha) args.push(meta.sha as string)
      await gitCli.run(args, { cwd, signal })
      return `Created tag ${name}`
    }
    case 'tag':
      return routeAction({ kind: 'create-tag', target, meta }, ctx)
    case 'delete-tag':
      if (!target) throw new GitError('Unknown', 'No tag specified.')
      await gitCli.run(['tag', '-d', target], { cwd, signal })
      return `Deleted tag ${target}`
    case 'checkout-tag':
      if (!target) throw new GitError('Unknown', 'No tag specified.')
      await gitCli.run(['checkout', 'tags/' + target], { cwd, signal })
      return `Checked out tag ${target}`

    case 'refresh':
      return 'Repository refreshed'
    case 'undo':
    case 'redo':
      return 'Undo/redo not yet available for this repository'
    case 'open-terminal':
    case 'reveal-in-finder':
    case 'open-remote':
    case 'copy-sha':
    case 'open-on-github':
      return 'Handled in renderer'

    default:
      throw new GitError('Unknown', `Unsupported action: ${action.kind}`)
  }
}
