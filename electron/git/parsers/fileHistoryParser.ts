import type { FileHistoryEntry } from '@shared/git/models'

/** Parse `git log --follow --format=...` output into file history entries. */
export function parseFileHistory(stdout: string): FileHistoryEntry[] {
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, subject, author, at] = line.split('\x1f')
      if (!sha) return null
      return {
        sha,
        shortSha: sha.slice(0, 7),
        subject: subject ?? '',
        author: author ?? '',
        date: new Date(Number(at) * 1000).toISOString(),
      }
    })
    .filter((entry): entry is FileHistoryEntry => entry != null)
}
