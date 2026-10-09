import { highlightLine } from './highlight'

export interface WordSegment {
  text: string
  changed: boolean
}

const MAX_TOKENS_FOR_LCS = 200

function tokenize(text: string): string[] {
  if (!text) return []
  return text.split(/(\s+)/).filter((t) => t.length > 0)
}

function commonPrefixLen(a: string[], b: string[]): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

function commonSuffixLen(a: string[], b: string[], prefix: number): number {
  let i = 0
  while (
    i < a.length - prefix &&
    i < b.length - prefix &&
    a[a.length - 1 - i] === b[b.length - 1 - i]
  )
    i++
  return i
}

/** Char-level split of a single old/new token pair into shared/changed parts. */
function splitChangedToken(
  oldToken: string,
  newToken: string,
): { oldParts: WordSegment[]; newParts: WordSegment[] } {
  if (oldToken === newToken) {
    return {
      oldParts: [{ text: oldToken, changed: false }],
      newParts: [{ text: newToken, changed: false }],
    }
  }
  // Don't char-split pure whitespace; treat whole token as changed.
  if (/^\s+$/.test(oldToken) || /^\s+$/.test(newToken)) {
    return {
      oldParts: [{ text: oldToken, changed: true }],
      newParts: [{ text: newToken, changed: true }],
    }
  }
  let prefix = 0
  while (
    prefix < oldToken.length &&
    prefix < newToken.length &&
    oldToken[prefix] === newToken[prefix]
  )
    prefix++
  let suffix = 0
  while (
    suffix < oldToken.length - prefix &&
    suffix < newToken.length - prefix &&
    oldToken[oldToken.length - 1 - suffix] === newToken[newToken.length - 1 - suffix]
  )
    suffix++
  const oldParts: WordSegment[] = []
  const newParts: WordSegment[] = []
  if (prefix > 0) {
    oldParts.push({ text: oldToken.slice(0, prefix), changed: false })
    newParts.push({ text: newToken.slice(0, prefix), changed: false })
  }
  const oldMid = oldToken.slice(prefix, oldToken.length - suffix)
  const newMid = newToken.slice(prefix, newToken.length - suffix)
  if (oldMid) oldParts.push({ text: oldMid, changed: true })
  if (newMid) newParts.push({ text: newMid, changed: true })
  if (suffix > 0) {
    oldParts.push({ text: oldToken.slice(oldToken.length - suffix), changed: false })
    newParts.push({ text: newToken.slice(newToken.length - suffix), changed: false })
  }
  return { oldParts, newParts }
}

/**
 * Token-level diff of two line contents.
 * Returns per-side segments; `changed` marks the intra-line portion
 * that differs (GitHub-style word highlight).
 */
export function diffWords(
  oldText: string,
  newText: string,
): { oldSegments: WordSegment[]; newSegments: WordSegment[] } {
  if (oldText === newText) {
    return {
      oldSegments: oldText ? [{ text: oldText, changed: false }] : [],
      newSegments: newText ? [{ text: newText, changed: false }] : [],
    }
  }
  if (!oldText || !newText) {
    return {
      oldSegments: oldText ? [{ text: oldText, changed: true }] : [],
      newSegments: newText ? [{ text: newText, changed: true }] : [],
    }
  }

  const oldTokens = tokenize(oldText)
  const newTokens = tokenize(newText)

  // Bound LCS cost; fall back to prefix/suffix-only for huge lines.
  if (oldTokens.length > MAX_TOKENS_FOR_LCS || newTokens.length > MAX_TOKENS_FOR_LCS) {
    const prefix = commonPrefixLen(oldTokens, newTokens)
    const suffix = commonSuffixLen(oldTokens, newTokens, prefix)
    const oldMid = oldTokens.slice(prefix, oldTokens.length - suffix).join('')
    const newMid = newTokens.slice(prefix, newTokens.length - suffix).join('')
    return {
      oldSegments: [
        ...(prefix > 0
          ? [{ text: oldTokens.slice(0, prefix).join(''), changed: false as const }]
          : []),
        ...(oldMid ? [{ text: oldMid, changed: true as const }] : []),
        ...(suffix > 0
          ? [
              {
                text: oldTokens.slice(oldTokens.length - suffix).join(''),
                changed: false as const,
              },
            ]
          : []),
      ],
      newSegments: [
        ...(prefix > 0
          ? [{ text: newTokens.slice(0, prefix).join(''), changed: false as const }]
          : []),
        ...(newMid ? [{ text: newMid, changed: true as const }] : []),
        ...(suffix > 0
          ? [
              {
                text: newTokens.slice(newTokens.length - suffix).join(''),
                changed: false as const,
              },
            ]
          : []),
      ],
    }
  }

  // LCS DP over tokens.
  const n = oldTokens.length
  const m = newTokens.length
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        oldTokens[i] === newTokens[j]
          ? (dp[i + 1][j + 1] + 1) as number
          : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  // Walk the DP table, collecting runs of deletions/insertions.
  const oldSegments: WordSegment[] = []
  const newSegments: WordSegment[] = []
  let i = 0
  let j = 0
  let oldRun: string[] = []
  let newRun: string[] = []
  const flushRuns = (): void => {
    if (oldRun.length === 0 && newRun.length === 0) return
    // Single-token replacement gets char-level refinement (e.g. `1` → `2` in `= 1`).
    if (oldRun.length === 1 && newRun.length === 1) {
      const { oldParts, newParts } = splitChangedToken(oldRun[0], newRun[0])
      oldSegments.push(...oldParts)
      newSegments.push(...newParts)
    } else {
      for (const t of oldRun) oldSegments.push({ text: t, changed: true })
      for (const t of newRun) newSegments.push({ text: t, changed: true })
    }
    oldRun = []
    newRun = []
  }

  while (i < n && j < m) {
    if (oldTokens[i] === newTokens[j]) {
      flushRuns()
      oldSegments.push({ text: oldTokens[i], changed: false })
      newSegments.push({ text: newTokens[j], changed: false })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      oldRun.push(oldTokens[i])
      i++
    } else {
      newRun.push(newTokens[j])
      j++
    }
  }
  while (i < n) {
    oldRun.push(oldTokens[i])
    i++
  }
  while (j < m) {
    newRun.push(newTokens[j])
    j++
  }
  flushRuns()

  return { oldSegments, newSegments }
}

/** True when an inline word highlight is meaningful for the pair. */
export function shouldInlineHighlight(oldText: string, newText: string): boolean {
  if (!oldText || !newText || oldText === newText) return false
  // Pure add/del of a whole line with no counterpart is handled by row tint alone.
  return true
}

function renderSegments(segments: WordSegment[], language: string, cssClass: string): string {
  return segments
    .map((seg) => {
      if (!seg.text) return ''
      const html = highlightLine(seg.text, language)
      if (!seg.changed || !html) return html
      return `<span class="${cssClass}">${html}</span>`
    })
    .join('')
}

/**
 * Renders a paired del/add line with syntax highlighting preserved and
 * only the changed words wrapped for strong background tint.
 */
export function renderInlineDiff(
  oldText: string,
  newText: string,
  language: string,
): { oldHtml: string; newHtml: string } {
  const { oldSegments, newSegments } = diffWords(oldText, newText)
  return {
    oldHtml: renderSegments(oldSegments, language, 'diff-word-del'),
    newHtml: renderSegments(newSegments, language, 'diff-word-add'),
  }
}
