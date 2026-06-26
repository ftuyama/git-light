import type { GitErrorCode } from './errors'

/** Actionable recovery hints shown alongside Git error toasts in the UI. */
export function credentialHintFor(code: GitErrorCode): string | undefined {
  switch (code) {
    case 'Authentication':
      return 'Verify SSH keys (ssh-add -l), HTTPS credentials, or your OS credential manager. For GitHub, ensure your SSH key is added at github.com/settings/keys.'
    case 'Network':
      return 'Check your internet connection and VPN. Confirm the remote URL with git remote -v.'
    case 'RemoteRejected':
      return 'Pull or rebase before pushing. Use force push only if you intend to overwrite remote history.'
    case 'DirtyWorktree':
      return 'Commit, stash, or discard local changes before switching branches or pulling.'
    default:
      return undefined
  }
}
