import type { DiffHunk, DiffLine } from '@shared/git/models'

/** Builds a unified diff patch for `git apply --cached`. */
export function buildPatch(path: string, hunks: DiffHunk[], oldPath?: string): string {
  const aPath = oldPath ?? path
  let out = `diff --git a/${aPath} b/${path}\n`
  out += `--- a/${aPath}\n`
  out += `+++ b/${path}\n`
  for (const hunk of hunks) {
    out += formatHunk(hunk)
  }
  return out
}

export function buildPatchFromHunk(path: string, hunk: DiffHunk, oldPath?: string): string {
  return buildPatch(path, [hunk], oldPath)
}

/** Builds a patch containing only the selected change lines (plus bridging context). */
export function buildPatchFromHunkLines(
  path: string,
  hunk: DiffHunk,
  lineIndices: number[],
  oldPath?: string,
): string {
  const subset = subsetHunkLines(hunk, lineIndices)
  return buildPatch(path, [subset], oldPath)
}

function formatHunk(hunk: DiffHunk): string {
  let out = `${hunk.header}\n`
  for (const line of hunk.lines) {
    if (line.type === 'meta') {
      out += `${line.content}\n`
    } else if (line.type === 'add') {
      out += `+${line.content}\n`
    } else if (line.type === 'del') {
      out += `-${line.content}\n`
    } else {
      out += ` ${line.content}\n`
    }
  }
  return out
}

function subsetHunkLines(hunk: DiffHunk, lineIndices: number[]): DiffHunk {
  if (lineIndices.length === 0) {
    throw new Error('No lines selected for partial staging')
  }

  const sorted = [...lineIndices].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const selected = new Set(lineIndices)
  const { start, end } = extendRangeWithContext(hunk, min, max)

  const lines: DiffLine[] = []
  for (let i = start; i <= end; i++) {
    const line = hunk.lines[i]
    if (!line) continue
    if (line.type === 'context') {
      lines.push(line)
    } else if (line.type === 'add' || line.type === 'del') {
      if (selected.has(i)) lines.push(line)
    }
  }

  if (lines.length === 0) {
    throw new Error('No stageable lines in selection')
  }

  return recalculateHunkHeader(lines)
}

const MAX_CONTEXT_LINES = 3

function extendRangeWithContext(
  hunk: DiffHunk,
  min: number,
  max: number,
): { start: number; end: number } {
  let start = min
  let end = max

  let leadingContext = 0
  while (
    start > 0 &&
    hunk.lines[start - 1]?.type === 'context' &&
    leadingContext < MAX_CONTEXT_LINES
  ) {
    start--
    leadingContext++
  }
  if (leadingContext === 0 && start > 0 && hunk.lines[start - 1]?.type === 'context') {
    start--
  }

  let trailingContext = 0
  while (
    end < hunk.lines.length - 1 &&
    hunk.lines[end + 1]?.type === 'context' &&
    trailingContext < MAX_CONTEXT_LINES
  ) {
    end++
    trailingContext++
  }

  return { start, end }
}

function recalculateHunkHeader(lines: DiffLine[]): DiffHunk {
  let oldLines = 0
  let newLines = 0
  for (const line of lines) {
    if (line.type === 'context' || line.type === 'del') oldLines++
    if (line.type === 'context' || line.type === 'add') newLines++
  }

  const { oldStart, newStart } = hunkStart(lines)
  const header = `@@ -${oldStart},${oldLines} +${newStart},${newLines} @@`

  return {
    header,
    oldStart,
    oldLines,
    newStart,
    newLines,
    lines,
  }
}

function hunkStart(lines: DiffLine[]): { oldStart: number; newStart: number } {
  for (const line of lines) {
    if (line.type === 'context' || line.type === 'del') {
      if (line.oldLine != null) {
        return { oldStart: line.oldLine, newStart: line.newLine ?? line.oldLine }
      }
    }
  }
  for (const line of lines) {
    if (line.type === 'add' && line.newLine != null) {
      return { oldStart: Math.max(1, line.newLine - 1), newStart: line.newLine }
    }
  }
  return { oldStart: 1, newStart: 1 }
}
