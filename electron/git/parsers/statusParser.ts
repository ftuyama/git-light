import type { WireFileStatus, WireWorkingTreeFile } from '@shared/git/models'

export interface NumstatEntry {
  additions: number
  deletions: number
}

/** Parses `git diff --numstat -z` into a path -> counts map. */
export function parseNumstat(stdout: string): Map<string, NumstatEntry> {
  const map = new Map<string, NumstatEntry>()
  // -z numstat: "<add>\t<del>\t" then NUL-terminated path. Renames emit two
  // extra NUL tokens (old, new) in place of the inline path.
  const tokens = stdout.split('\0')
  let i = 0
  while (i < tokens.length) {
    const head = tokens[i]
    if (!head || !head.includes('\t')) {
      i++
      continue
    }
    const [addRaw, delRaw, inlinePath] = head.split('\t')
    const additions = addRaw === '-' ? 0 : Number(addRaw) || 0
    const deletions = delRaw === '-' ? 0 : Number(delRaw) || 0

    let path = inlinePath
    if (path === '' || path === undefined) {
      // Rename: next two tokens are old then new path.
      i += 1 // consume old path token (tokens[i])
      const newPath = tokens[i + 1]
      path = newPath ?? ''
      i += 2
    } else {
      i += 1
    }
    if (path) map.set(path, { additions, deletions })
  }
  return map
}

function splitPath(fullPath: string): { fileName: string; directory: string } {
  const idx = fullPath.lastIndexOf('/')
  if (idx === -1) return { fileName: fullPath, directory: '' }
  return { fileName: fullPath.slice(idx + 1), directory: fullPath.slice(0, idx) }
}

function mapCode(code: string): WireFileStatus {
  switch (code) {
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    case 'C':
      return 'copied'
    case 'U':
      return 'conflicted'
    case 'M':
    case 'T':
    default:
      return 'modified'
  }
}

interface BuildArgs {
  porcelain: string
  staged: Map<string, NumstatEntry>
  unstaged: Map<string, NumstatEntry>
}

/**
 * Parses `git status --porcelain=v2 -z`. A path with both index and worktree
 * changes yields two rows (one staged, one unstaged), matching how GitKraken
 * lists the same file in both sections.
 */
export function parseStatus({ porcelain, staged, unstaged }: BuildArgs): WireWorkingTreeFile[] {
  const files: WireWorkingTreeFile[] = []
  const tokens = porcelain.split('\0')
  let id = 0

  const push = (
    path: string,
    status: WireFileStatus,
    isStaged: boolean,
    counts: NumstatEntry | undefined,
    oldPath?: string,
    isSubmodule?: boolean,
  ): void => {
    const { fileName, directory } = splitPath(path)
    files.push({
      id: `file:${id++}`,
      path,
      fileName,
      directory,
      status,
      staged: isStaged,
      additions: counts?.additions ?? 0,
      deletions: counts?.deletions ?? 0,
      oldPath,
      isSubmodule,
    })
  }

  for (let i = 0; i < tokens.length; i++) {
    const line = tokens[i]
    if (!line) continue
    const type = line[0]

    if (type === '1') {
      // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
      const parts = line.split(' ')
      const xy = parts[1] ?? '..'
      const sub = parts[2] ?? '....'
      const path = parts.slice(8).join(' ')
      const isSubmodule = sub[0] === 'S'
      const x = xy[0]
      const y = xy[1]
      if (x && x !== '.') push(path, mapCode(x), true, staged.get(path), undefined, isSubmodule)
      if (y && y !== '.') push(path, mapCode(y), false, unstaged.get(path), undefined, isSubmodule)
    } else if (type === '2') {
      // 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <Xscore> <path>  then NUL <origPath>
      const parts = line.split(' ')
      const xy = parts[1] ?? '..'
      const sub = parts[2] ?? '....'
      const path = parts.slice(9).join(' ')
      const origPath = tokens[i + 1] ?? undefined
      i += 1 // consume origPath token
      const isSubmodule = sub[0] === 'S'
      const x = xy[0]
      const y = xy[1]
      if (x && x !== '.') push(path, mapCode(x), true, staged.get(path), origPath, isSubmodule)
      if (y && y !== '.') push(path, mapCode(y), false, unstaged.get(path), origPath, isSubmodule)
    } else if (type === 'u') {
      // u <xy> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
      const parts = line.split(' ')
      const path = parts.slice(10).join(' ')
      push(path, 'conflicted', false, undefined)
    } else if (type === '?') {
      const path = line.slice(2)
      push(path, 'untracked', false, unstaged.get(path))
    } else if (type === '!') {
      const path = line.slice(2)
      push(path, 'ignored', false, undefined)
    }
  }

  return files
}
