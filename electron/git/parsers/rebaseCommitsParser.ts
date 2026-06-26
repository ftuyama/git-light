import type { RebaseCommitEntry } from '@shared/git/rebase'

const FIELD = '\x1f'
const RECORD = '\x1e'

export const REBASE_LOG_FORMAT = ['%H', '%h', '%s', '%an', '%at'].join(FIELD) + RECORD

export function parseRebaseCommits(stdout: string): RebaseCommitEntry[] {
  const commits: RebaseCommitEntry[] = []
  const trimmed = stdout.trim()
  if (!trimmed) return commits

  for (const record of trimmed.split(RECORD)) {
    const line = record.trim()
    if (!line) continue
    const [sha, shortSha, subject, authorName, at] = line.split(FIELD)
    if (!sha || !shortSha || subject == null) continue
    const timestamp = Number(at)
    commits.push({
      sha,
      shortSha,
      subject,
      authorName: authorName ?? '',
      date: Number.isFinite(timestamp) ? new Date(timestamp * 1000).toISOString() : new Date(0).toISOString(),
    })
  }

  return commits
}
