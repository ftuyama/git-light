import type { WireBlameLine } from '@shared/git/models'

export interface BlameBlock {
  commitSha: string
  shortSha: string
  author: string
  authorEmail: string
  authorTime: number
  summary?: string
  startLineIndex: number
  lineCount: number
  colorIndex: number
}

export function buildBlameBlocks(lines: WireBlameLine[]): BlameBlock[] {
  if (lines.length === 0) return []

  const blocks: BlameBlock[] = []
  const colorBySha = new Map<string, number>()
  let nextColorIndex = 0

  let startLineIndex = 0
  let currentSha = lines[0]!.commitSha

  for (let i = 1; i <= lines.length; i++) {
    const line = lines[i]
    if (line && line.commitSha === currentSha) continue

    const first = lines[startLineIndex]!
    if (!colorBySha.has(currentSha)) {
      colorBySha.set(currentSha, nextColorIndex++)
    }

    blocks.push({
      commitSha: currentSha,
      shortSha: first.shortSha,
      author: first.author,
      authorEmail: first.authorEmail,
      authorTime: first.authorTime,
      summary: first.summary,
      startLineIndex,
      lineCount: i - startLineIndex,
      colorIndex: colorBySha.get(currentSha)!,
    })

    if (!line) break
    startLineIndex = i
    currentSha = line.commitSha
  }

  return blocks
}

export function blockForLineIndex(blocks: BlameBlock[], lineIndex: number): BlameBlock | undefined {
  let lo = 0
  let hi = blocks.length - 1

  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const block = blocks[mid]!
    if (lineIndex < block.startLineIndex) {
      hi = mid - 1
    } else if (lineIndex >= block.startLineIndex + block.lineCount) {
      lo = mid + 1
    } else {
      return block
    }
  }

  return undefined
}

export function isBlockStart(block: BlameBlock, lineIndex: number): boolean {
  return lineIndex === block.startLineIndex
}
