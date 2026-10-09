export interface PaletteCommand {
  id: string
  title: string
  hint?: string
  keywords?: string
  run: () => void | Promise<unknown>
}

function normalize(text: string): string {
  return text.toLowerCase()
}

/**
 * Subsequence fuzzy match: every query char must appear in order in the
 * haystack. Scores contiguous runs higher and earlier matches higher;
 * lower is better. Returns null when not all chars match.
 */
export function fuzzyScore(query: string, haystack: string): number | null {
  const q = normalize(query.trim())
  if (!q) return 0
  const h = normalize(haystack)
  let score = 0
  let hi = 0
  let lastMatch = -2
  for (const char of q) {
    const found = h.indexOf(char, hi)
    if (found === -1) return null
    if (found === lastMatch + 1) score -= 2
    else score += found - hi
    lastMatch = found
    hi = found + 1
  }
  return score
}

export function filterCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const text = query.trim()
  if (!text) return [...commands]
  const scored: { command: PaletteCommand; score: number }[] = []
  for (const command of commands) {
    const haystack = command.keywords ? `${command.title} ${command.keywords}` : command.title
    const score = fuzzyScore(text, haystack)
    if (score !== null) scored.push({ command, score })
  }
  scored.sort((a, b) => a.score - b.score || a.command.title.localeCompare(b.command.title))
  return scored.map((entry) => entry.command)
}
