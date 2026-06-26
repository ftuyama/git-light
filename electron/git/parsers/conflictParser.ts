export interface ParsedConflictBlock {
  index: number
  oursLabel: string
  theirsLabel: string
  ours: string
  theirs: string
  base?: string
  /** 1-based line where `<<<<<<<` starts. */
  startLine: number
  /** 1-based line where `>>>>>>>` ends. */
  endLine: number
}

export function parseConflictMarkers(content: string): {
  blocks: ParsedConflictBlock[]
  hasMarkers: boolean
} {
  const lines = content.split('\n')
  const blocks: ParsedConflictBlock[] = []
  let i = 0

  while (i < lines.length) {
    const startMatch = lines[i].match(/^<<<<<<< (.+)$/)
    if (!startMatch) {
      i++
      continue
    }

    const startLine = i + 1
    const oursLabel = startMatch[1]
    i++
    const oursLines: string[] = []
    let base: string | undefined

    while (i < lines.length && !lines[i].startsWith('=======')) {
      const baseMatch = lines[i].match(/^\|\|\|\|\|\|\| (.+)$/)
      if (baseMatch) {
        i++
        const baseLines: string[] = []
        while (i < lines.length && !lines[i].startsWith('=======')) {
          baseLines.push(lines[i])
          i++
        }
        base = baseLines.join('\n')
        break
      }
      oursLines.push(lines[i])
      i++
    }

    if (i >= lines.length || !lines[i].startsWith('=======')) break
    i++

    const theirsLines: string[] = []
    while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
      theirsLines.push(lines[i])
      i++
    }

    const endMatch = lines[i]?.match(/^>>>>>>> (.+)$/)
    if (!endMatch) break

    blocks.push({
      index: blocks.length,
      oursLabel,
      theirsLabel: endMatch[1],
      ours: oursLines.join('\n'),
      theirs: theirsLines.join('\n'),
      base,
      startLine,
      endLine: i + 1,
    })
    i++
  }

  return { blocks, hasMarkers: blocks.length > 0 }
}

/** Replace one conflict block with the chosen side and return the updated file content. */
export function applyConflictResolution(
  content: string,
  blockIndex: number,
  side: 'ours' | 'theirs',
): string {
  const { blocks } = parseConflictMarkers(content)
  const block = blocks[blockIndex]
  if (!block) {
    throw new Error(`Conflict block ${blockIndex} not found`)
  }

  const replacement = (side === 'ours' ? block.ours : block.theirs).split('\n')
  const lines = content.split('\n')
  const before = lines.slice(0, block.startLine - 1)
  const after = lines.slice(block.endLine)
  return [...before, ...replacement, ...after].join('\n')
}
