import type { WireWorktree } from '@shared/git/models'

/**
 * Parses `git worktree list --porcelain`. Records are separated by a blank
 * line; each record has `worktree <path>`, optional `branch <ref>`, `bare`,
 * `detached`, and `locked` lines.
 */
export function parseWorktrees(stdout: string, mainPath: string): WireWorktree[] {
  const worktrees: WireWorktree[] = []
  const blocks = stdout.split(/\n\n+/)
  let id = 0

  for (const block of blocks) {
    if (!block.trim()) continue
    let path = ''
    let branch = ''
    let detached = false
    let locked = false
    let bare = false

    for (const lineRaw of block.split('\n')) {
      const line = lineRaw.trim()
      if (line.startsWith('worktree ')) path = line.slice('worktree '.length)
      else if (line.startsWith('branch ')) branch = line.slice('branch '.length).replace('refs/heads/', '')
      else if (line === 'detached') detached = true
      else if (line.startsWith('locked')) locked = true
      else if (line === 'bare') bare = true
    }

    if (!path) continue
    worktrees.push({
      id: `wt:${id++}`,
      path,
      branch: detached ? 'detached HEAD' : branch || (bare ? 'bare' : ''),
      isMain: path === mainPath,
      isLocked: locked,
    })
  }

  return worktrees
}
