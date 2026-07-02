export const DIFF_ROW_HEIGHT = 20
export const MONO_CHAR_WIDTH = 6

export function estimateWrappedLineCount(content: string, codeWidth: number): number {
  if (codeWidth <= 0) return 1
  const charsPerLine = Math.max(1, Math.floor(codeWidth / MONO_CHAR_WIDTH))
  let lines = 1
  let currentLength = 0
  for (const char of content) {
    if (char === '\n') {
      lines += 1
      currentLength = 0
      continue
    }
    currentLength += 1
    if (currentLength > charsPerLine) {
      lines += 1
      currentLength = 1
    }
  }
  return lines
}

export function estimateWrappedRowHeight(content: string, codeWidth: number): number {
  return estimateWrappedLineCount(content, codeWidth) * DIFF_ROW_HEIGHT
}
