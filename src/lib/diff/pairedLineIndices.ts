import type { DiffHunk } from '@shared/git/models'

/** Returns line indices to stage together for a clicked del/add (1:1 pairing within a change block). */
export function pairedLineIndices(hunk: DiffHunk, lineIndex: number): number[] {
  const lines = hunk.lines
  const line = lines[lineIndex]
  if (!line || (line.type !== 'add' && line.type !== 'del')) return [lineIndex]

  if (line.type === 'del') {
    let delStart = lineIndex
    while (delStart > 0 && lines[delStart - 1].type === 'del') delStart--

    let addStart = lineIndex + 1
    while (addStart < lines.length && lines[addStart].type === 'del') addStart++

    const delOffset = lineIndex - delStart
    const addIndex = addStart + delOffset
    if (addIndex < lines.length && lines[addIndex].type === 'add') {
      return [lineIndex, addIndex]
    }
    return [lineIndex]
  }

  let addStart = lineIndex
  while (addStart > 0 && lines[addStart - 1].type === 'add') addStart--

  let delEnd = addStart - 1
  let delStart = delEnd
  while (delStart > 0 && lines[delStart - 1].type === 'del') delStart--

  const addOffset = lineIndex - addStart
  const delIndex = delStart + addOffset
  if (delIndex <= delEnd && lines[delIndex]?.type === 'del') {
    return [delIndex, lineIndex]
  }
  return [lineIndex]
}

/** Collects unique line indices from optional left/right split row indices. */
export function collectSplitLineIndices(left?: number, right?: number): number[] {
  const indices: number[] = []
  if (left != null) indices.push(left)
  if (right != null && right !== left) indices.push(right)
  return indices
}
