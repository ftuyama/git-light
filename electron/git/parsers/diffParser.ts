import { guessLanguage } from '@shared/diff/guessLanguage'
import type { DiffHunk, DiffLine, DiffResult } from '@shared/git/models'

/** Parses unified diff output into structured hunks for the diff viewer. */
export function parseUnifiedDiff(path: string, raw: string): DiffResult {
  if (!raw.trim()) {
    return {
      path,
      binary: false,
      tooLarge: false,
      language: guessLanguage(path),
      hunks: [],
      additions: 0,
      deletions: 0,
    }
  }

  if (raw.includes('Binary files') || raw.includes('GIT binary patch')) {
    return {
      path,
      binary: true,
      tooLarge: false,
      language: guessLanguage(path),
      hunks: [],
      additions: 0,
      deletions: 0,
    }
  }

  const lines = raw.split('\n')
  const hunks: DiffHunk[] = []
  let current: DiffHunk | null = null
  let oldLine = 0
  let newLine = 0
  let additions = 0
  let deletions = 0
  let oldPath: string | undefined

  for (const line of lines) {
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).trim()
      if (p.startsWith('b/')) oldPath = undefined
      else if (p !== `/dev/null`) {
        /* keep path */
      }
      continue
    }
    if (line.startsWith('--- ')) {
      const p = line.slice(4).trim()
      if (p.startsWith('a/')) oldPath = p.slice(2)
      continue
    }
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/)
    if (hunkMatch) {
      if (current) hunks.push(current)
      oldLine = Number(hunkMatch[1])
      newLine = Number(hunkMatch[3])
      current = {
        header: line,
        oldStart: oldLine,
        oldLines: Number(hunkMatch[2] ?? 1),
        newStart: newLine,
        newLines: Number(hunkMatch[4] ?? 1),
        lines: [],
      }
      continue
    }

    if (!current) continue

    if (line.startsWith('+')) {
      current.lines.push(lineEntry('add', line.slice(1), null, newLine++))
      additions++
    } else if (line.startsWith('-')) {
      current.lines.push(lineEntry('del', line.slice(1), oldLine++, null))
      deletions++
    } else if (line.startsWith(' ') || line === '') {
      current.lines.push(lineEntry('context', line.slice(1) || '', oldLine++, newLine++))
    } else if (line.startsWith('\\')) {
      current.lines.push(lineEntry('meta', line, null, null))
    }
  }

  if (current) hunks.push(current)

  return {
    path,
    oldPath,
    binary: false,
    tooLarge: false,
    language: guessLanguage(path),
    hunks,
    additions,
    deletions,
  }
}

function lineEntry(
  type: DiffLine['type'],
  content: string,
  oldLine: number | null,
  newLine: number | null,
): DiffLine {
  return { type, content, oldLine, newLine }
}

