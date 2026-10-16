/** O(1) SHA lookups over the commit list. Built once per snapshot. */
export function buildCommitIndex(commits: { sha: string }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (let i = 0; i < commits.length; i++) {
    const sha = commits[i].sha
    if (!map.has(sha)) map.set(sha, i)
  }
  return map
}
