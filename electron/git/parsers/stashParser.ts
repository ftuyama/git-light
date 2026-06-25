import type { WireStash } from '@shared/git/models'

const FIELD = '\x1f'

/** `git stash list` format. */
export const STASH_FORMAT = ['%gd', '%ct', '%gs'].join(FIELD)

export function parseStashes(stdout: string): WireStash[] {
  const stashes: WireStash[] = []
  let index = 0
  for (const lineRaw of stdout.split('\n')) {
    const line = lineRaw.replace(/[\r\n]+$/, '')
    if (!line.trim()) continue
    const [selector, ts, subject] = line.split(FIELD)

    // %gs looks like "WIP on main: 1a2b3c message" or "On main: message".
    const branchMatch = subject?.match(/(?:WIP on|On)\s+([^:]+):/)
    const branch = branchMatch ? branchMatch[1].trim() : ''

    stashes.push({
      id: selector || `stash@{${index}}`,
      index,
      message: subject ?? '',
      branch,
      date: ts ? new Date(Number(ts) * 1000).toISOString() : new Date(0).toISOString(),
      filesChanged: 0,
    })
    index++
  }
  return stashes
}
