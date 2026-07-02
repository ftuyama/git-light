import type { WireBlameLine } from '@shared/git/models'

/** Parse `git blame --line-porcelain` output into per-line attribution records. */
export function parseBlamePorcelain(stdout: string): WireBlameLine[] {
  const lines: WireBlameLine[] = []
  const rawLines = stdout.split('\n')
  let i = 0

  while (i < rawLines.length) {
    const header = rawLines[i]
    if (!header) {
      i++
      continue
    }

    const headerMatch = /^([0-9a-f]{4,40})\s+(\d+)\s+(\d+)(?:\s+(\d+))?/.exec(header)
    if (!headerMatch) {
      i++
      continue
    }

    const commitSha = headerMatch[1]!
    const lineNumber = Number(headerMatch[3])
    i++

    let author = ''
    let authorEmail = ''
    let authorTime = 0
    let content = ''

    while (i < rawLines.length) {
      const line = rawLines[i]!
      if (line.startsWith('\t')) {
        content = line.slice(1)
        i++
        break
      }
      if (line.startsWith('author ')) author = line.slice('author '.length)
      else if (line.startsWith('author-mail ')) authorEmail = line.slice('author-mail '.length)
      else if (line.startsWith('author-time ')) authorTime = Number(line.slice('author-time '.length))
      i++
    }

    lines.push({
      lineNumber,
      commitSha,
      shortSha: commitSha.slice(0, 7),
      author,
      authorEmail,
      authorTime,
      content,
    })
  }

  return lines
}
