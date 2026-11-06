export interface GithubRepo {
  owner: string
  repo: string
}

/** Parse a Git remote URL into a GitHub owner/repo pair, or null if unsupported. */
export function parseGithubRepoPath(remoteUrl: string): GithubRepo | null {
  const trimmed = remoteUrl.trim()
  if (!trimmed) return null

  const httpsMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/.]+?)(?:\.git)?\/?$/i)
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] }

  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/.]+?)(?:\.git)?$/i)
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] }

  const sshUrlMatch = trimmed.match(/^ssh:\/\/git@github\.com\/([^/]+)\/([^/.]+?)(?:\.git)?\/?$/i)
  if (sshUrlMatch) return { owner: sshUrlMatch[1], repo: sshUrlMatch[2] }

  return null
}

/** Build a GitHub commit URL from a remote URL and full SHA. */
export function githubCommitUrl(remoteUrl: string, sha: string): string | null {
  const parsed = parseGithubRepoPath(remoteUrl)
  if (!parsed) return null
  return `https://github.com/${parsed.owner}/${parsed.repo}/commit/${sha}`
}

/** Build a GitHub branch tree URL from a remote URL and branch name. */
export function githubBranchUrl(remoteUrl: string, branchName: string): string | null {
  const parsed = parseGithubRepoPath(remoteUrl)
  if (!parsed) return null
  const encoded = branchName
    .split('/')
    .filter((part) => part.length > 0)
    .map(encodeURIComponent)
    .join('/')
  if (!encoded) return null
  return `https://github.com/${parsed.owner}/${parsed.repo}/tree/${encoded}`
}
