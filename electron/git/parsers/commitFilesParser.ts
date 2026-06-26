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
    const counts = numstat.get(path) ?? { additions: 0, deletions: 0 }
    files.push({
      id: `commit-${id++}`,
      path,
      fileName,
      directory,
      status,
      staged: false,
      additions: counts.additions,
      deletions: counts.deletions,
      oldPath,
    })
  }

  return files
}
