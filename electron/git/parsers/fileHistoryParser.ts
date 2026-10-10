import type { FileHistoryEntry } from '@shared/git/models'

/** Parse `git log --follow --format=...` output into file history entries. */
export function parseFileHistory(stdout: string): FileHistoryEntry[] {
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const cleaned = line.endsWith('\r') ? line.slice(0, -1) : line
      const [sha, subject, author, at] = cleaned.split('\x1f')
      if (!sha) return null
      const timestamp = Number(at)
      if (!Number.isFinite(timestamp)) return null
      return {
        sha,
        shortSha: sha.slice(0, 7),
        subject: subject ?? '',
        author: author ?? '',
        date: new Date(timestamp * 1000).toISOString(),
      }
    })
    .filter((entry): entry is FileHistoryEntry => entry != null)
}
