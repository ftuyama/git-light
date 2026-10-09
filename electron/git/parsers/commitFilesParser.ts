import type { WireFileStatus, WireWorkingTreeFile } from '@shared/git/models'
import { parseNumstat } from './statusParser'

function splitPath(fullPath: string): { fileName: string; directory: string } {
  const idx = fullPath.lastIndexOf('/')
  if (idx === -1) return { fileName: fullPath, directory: '' }
  return { fileName: fullPath.slice(idx + 1), directory: fullPath.slice(0, idx) }
}

function mapStatusCode(code: string): WireFileStatus {
  switch (code.charAt(0)) {
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    case 'C':
      return 'copied'
    default:
      return 'modified'
  }
}

/** Parses `git diff-tree --name-status -z` output into commit file rows. */
export function parseCommitFiles(
  nameStatusStdout: string,
  numstatStdout: string,
): WireWorkingTreeFile[] {
  const numstat = parseNumstat(numstatStdout)
  const files: WireWorkingTreeFile[] = []
  const tokens = nameStatusStdout.split('\0').filter(Boolean)
  let id = 0
  let i = 0

  while (i < tokens.length) {
    const statusToken = tokens[i++]
    const status = mapStatusCode(statusToken)
    let path: string
    let oldPath: string | undefined

    if (status === 'renamed' || status === 'copied') {
      oldPath = tokens[i++]
      path = tokens[i++] ?? oldPath ?? ''
    } else {
      path = tokens[i++] ?? ''
    }

    if (!path) continue

    const { fileName, directory } = splitPath(path)
    const counts = numstat.get(path)
    const additions = counts?.additions ?? 0
    const deletions = counts?.deletions ?? 0
    const isEmptyDiff =
      counts != null && additions === 0 && deletions === 0 && !counts.binary
    const existing = files.find((f) => f.path === path)
    if (existing) {
      existing.additions = Math.max(existing.additions, additions)
      existing.deletions = Math.max(existing.deletions, deletions)
      if (!existing.oldPath && oldPath) existing.oldPath = oldPath
      continue
    }
    // Hide files with empty diff (+0 -0) from the commit files panel.
    // Binary entries report `-` (mapped to 0/0 + binary flag) and are kept.
    if (isEmptyDiff) continue

    files.push({
      id: `commit-${id++}`,
      path,
      fileName,
      directory,
      status,
      staged: false,
      additions,
      deletions,
      oldPath,
    })
  }

  return files
}
