import type { WireWorktree } from '@shared/git/models'

/**
 * Parses `git worktree list --porcelain`. Records are separated by a blank
 * line; each record has `worktree <path>`, optional `branch <ref>`, `bare`,
 * `detached`, and `locked` lines.
 */
function unquotePath(p: string): string {
  if (p.length >= 2 && p.startsWith('"') && p.endsWith('"')) {
    const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\' }
    return p
      .slice(1, -1)
      .replace(/\\([nrt"\\])/g, (_, c: string) => escapes[c] ?? c)
      .replace(/\\([0-7]{3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)))
  }
  return p
}

function normalizePath(p: string): string {
  return p.replace(/\/+$/, '')
}

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
      const line = lineRaw.endsWith('\r') ? lineRaw.slice(0, -1) : lineRaw
      const trimmed = line.trim()
      if (line.startsWith('worktree ')) path = unquotePath(line.slice('worktree '.length))
      else if (line.startsWith('branch '))
        branch = line.slice('branch '.length).replace('refs/heads/', '')
      else if (trimmed === 'detached') detached = true
      else if (trimmed.startsWith('locked')) locked = true
      else if (trimmed === 'bare') bare = true
    }

    if (!path) continue
    worktrees.push({
      id: `wt:${id++}`,
      path,
      branch: detached ? 'detached HEAD' : branch || (bare ? 'bare' : ''),
      isMain: normalizePath(path) === normalizePath(mainPath),
      isLocked: locked,
    })
  }

  return worktrees
}
