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

  if (/^Binary files /m.test(raw) || /^GIT binary patch/m.test(raw)) {
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

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx]
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    const isLast = idx === lines.length - 1
    if (line.startsWith('+++ ')) {
      continue
    }
    if (line.startsWith('--- ')) {
      const p = line.slice(4).trim()
      if (p.startsWith('a/')) oldPath = p.slice(2)
      else if (p !== '/dev/null') oldPath = p
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
    // Combined diff (merge) headers use `@@@`; skip without losing the file.
    if (line.startsWith('@@@')) continue

    if (!current) continue

    if (line.startsWith('+') && !line.startsWith('+++')) {
      current.lines.push(lineEntry('add', line.slice(1), null, newLine++))
      additions++
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      current.lines.push(lineEntry('del', line.slice(1), oldLine++, null))
      deletions++
    } else if (line.startsWith(' ') || (line === '' && !isLast)) {
      current.lines.push(lineEntry('context', line.slice(1), oldLine++, newLine++))
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

