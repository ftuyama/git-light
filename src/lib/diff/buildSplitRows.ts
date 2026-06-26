import type { DiffHunk, DiffLine } from '@shared/git/models'

export interface SplitSide {
  lineNum: number | null
  type: 'context' | 'add' | 'del' | 'empty'
  content: string
}

export interface SplitHunkRow {
  kind: 'hunk'
  key: string
  header: string
  hunkIndex: number
}

export interface SplitLineRow {
  kind: 'line'
  key: string
  left: SplitSide
  right: SplitSide
  hunkIndex: number
  leftLineIndex?: number
  rightLineIndex?: number
}

export type SplitRow = SplitHunkRow | SplitLineRow

const emptySide = (): SplitSide => ({
  lineNum: null,
  type: 'empty',
  content: '',
})

function toSide(line: DiffLine, side: 'left' | 'right'): SplitSide {
  const lineNum = side === 'left' ? line.oldLine : line.newLine
  return {
    lineNum,
    type: line.type === 'add' || line.type === 'del' || line.type === 'context' ? line.type : 'empty',
    content: line.content,
  }
}

type IndexedLine = DiffLine & { lineIndex: number }

function pairChangeBlock(
  dels: IndexedLine[],
  adds: IndexedLine[],
  keyBase: string,
  hunkIndex: number,
): SplitLineRow[] {
  const rows: SplitLineRow[] = []
  const count = Math.max(dels.length, adds.length)
  for (let i = 0; i < count; i++) {
    const del = dels[i]
    const add = adds[i]
    rows.push({
      kind: 'line',
      key: `${keyBase}-${del?.oldLine ?? 'x'}-${add?.newLine ?? 'y'}-${i}`,
      left: del ? toSide(del, 'left') : emptySide(),
      right: add ? toSide(add, 'right') : emptySide(),
      hunkIndex,
      leftLineIndex: del?.lineIndex,
      rightLineIndex: add?.lineIndex,
    })
  }
  return rows
}

/** Converts parsed hunks into side-by-side rows for split diff view. */
export function buildSplitRows(hunks: DiffHunk[]): SplitRow[] {
  const rows: SplitRow[] = []

  hunks.forEach((hunk, hunkIndex) => {
    const indexedLines = hunk.lines.map((line, lineIndex) => ({ ...line, lineIndex }))
    rows.push({ kind: 'hunk', key: hunk.header, header: hunk.header, hunkIndex })

    let i = 0
    while (i < indexedLines.length) {
      const line = indexedLines[i]

      if (line.type === 'context') {
        rows.push({
          kind: 'line',
          key: `${hunk.header}-ctx-${line.oldLine}-${line.newLine}`,
          left: toSide(line, 'left'),
          right: toSide(line, 'right'),
          hunkIndex,
          leftLineIndex: line.lineIndex,
          rightLineIndex: line.lineIndex,
        })
        i++
        continue
      }

      if (line.type === 'del') {
        const dels: IndexedLine[] = []
        while (i < indexedLines.length && indexedLines[i].type === 'del') {
          dels.push(indexedLines[i])
          i++
        }
        const adds: IndexedLine[] = []
        while (i < indexedLines.length && indexedLines[i].type === 'add') {
          adds.push(indexedLines[i])
          i++
        }
        rows.push(...pairChangeBlock(dels, adds, hunk.header, hunkIndex))
        continue
      }

      if (line.type === 'add') {
        rows.push({
          kind: 'line',
          key: `${hunk.header}-add-${line.newLine}`,
          left: emptySide(),
          right: toSide(line, 'right'),
          hunkIndex,
          rightLineIndex: line.lineIndex,
        })
        i++
        continue
      }

      i++
    }
  })

  return rows
}
