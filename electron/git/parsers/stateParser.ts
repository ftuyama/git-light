import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RepoState } from '@shared/git/models'

function readTrimmed(path: string): string | null {
  try {
    return readFileSync(path, 'utf8').trim()
  } catch {
    return null
  }
}

/**
 * Derives in-progress operation state by inspecting the `.git` directory,
 * mirroring how git itself reports `merging`, `rebasing`, etc.
 */
export function readRepoState(gitDir: string): RepoState {
  const merging = existsSync(join(gitDir, 'MERGE_HEAD'))
  const cherryPicking = existsSync(join(gitDir, 'CHERRY_PICK_HEAD'))
  const reverting = existsSync(join(gitDir, 'REVERT_HEAD'))
  const bisecting = existsSync(join(gitDir, 'BISECT_LOG'))
  const rebaseMerge = existsSync(join(gitDir, 'rebase-merge'))
  const rebaseApply = existsSync(join(gitDir, 'rebase-apply'))
  const rebasing = rebaseMerge || rebaseApply

  const head = readTrimmed(join(gitDir, 'HEAD'))
  const detachedHead = head != null && !head.startsWith('ref:')

  let operationLabel: string | null = null
  if (rebasing) {
    const dir = rebaseMerge ? 'rebase-merge' : 'rebase-apply'
    const msgnum = readTrimmed(join(gitDir, dir, rebaseMerge ? 'msgnum' : 'next'))
    const end = readTrimmed(join(gitDir, dir, rebaseMerge ? 'end' : 'last'))
    operationLabel = msgnum && end ? `REBASING (${msgnum}/${end})` : 'REBASING'
  } else if (merging) {
    operationLabel = 'MERGING'
  } else if (cherryPicking) {
    operationLabel = 'CHERRY-PICKING'
  } else if (reverting) {
    operationLabel = 'REVERTING'
  } else if (bisecting) {
    operationLabel = 'BISECTING'
  } else if (detachedHead) {
    operationLabel = 'DETACHED HEAD'
  }

  return {
    detachedHead,
    merging,
    rebasing,
    cherryPicking,
    reverting,
    bisecting,
    operationLabel,
  }
}
