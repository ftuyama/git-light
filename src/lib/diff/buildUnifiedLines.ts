import type { DiffHunk } from '@shared/git/models'

export interface UnifiedLine {
  key: string
  type: 'context' | 'add' | 'del' | 'hunk' | 'meta'
  content: string
  oldLine: number | null
  newLine: number | null
  hunkIndex: number
  /** Index within the parent hunk's `lines` array; omitted for hunk headers. */
  lineIndex?: number
}

/** Flattens parsed hunks into renderable unified diff lines. */
export function buildUnifiedLines(hunks: DiffHunk[]): UnifiedLine[] {
  const out: UnifiedLine[] = []
  hunks.forEach((hunk, hunkIndex) => {
    out.push({
      key: hunk.header,
      type: 'hunk',
      content: hunk.header,
      oldLine: null,
      newLine: null,
      hunkIndex,
    })
    hunk.lines.forEach((line, lineIndex) => {
      if (line.type === 'hunk') return
      out.push({
        key: `${hunk.header}-${line.oldLine}-${line.newLine}-${line.content}`,
        type: line.type,
        content: line.content,
        oldLine: line.oldLine,
        newLine: line.newLine,
        hunkIndex,
        lineIndex,
      })
    })
  })
  return out
}
