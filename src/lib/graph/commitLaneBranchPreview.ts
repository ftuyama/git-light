import { formatRefLabel } from '@shared/git/refLabel'
import type { Branch, Commit, Ref } from '@/types/git'
import type { GraphLayout } from './computeGraphLayout'

export interface BranchPreview {
  ref: Ref
  hasLocal: boolean
  hasRemote: boolean
}

function refDisplayLabel(ref: Ref): string {
  return ref.label || formatRefLabel(ref.name, ref.type)
}

function refPriority(ref: Ref): number {
  if (ref.isHead) return 0
  if (ref.type === 'localBranch') return 1
  if (ref.type === 'remoteBranch') return 2
  return 3
}

function branchPresence(refs: Ref[]): { hasLocal: boolean; hasRemote: boolean } {
  return {
    hasLocal: refs.some((r) => r.type === 'localBranch'),
    hasRemote: refs.some((r) => r.type === 'remoteBranch'),
  }
}

function branchRefsFromCommit(commit: Commit): BranchPreview[] {
  const byLabel = new Map<string, Ref>()
  const refsByLabel = new Map<string, Ref[]>()
  for (const ref of commit.refs) {
    if (ref.type === 'head') continue
    if (ref.type !== 'localBranch' && ref.type !== 'remoteBranch') continue
    const label = refDisplayLabel(ref)
    const group = refsByLabel.get(label) ?? []
    group.push(ref)
    refsByLabel.set(label, group)
    const existing = byLabel.get(label)
    if (!existing || refPriority(ref) < refPriority(existing)) {
      byLabel.set(label, ref)
    }
  }
  return [...byLabel.entries()]
    .map(([label, ref]) => ({
      ref: { ...ref, isHead: false },
      ...branchPresence(refsByLabel.get(label) ?? []),
    }))
    .sort((a, b) => {
      const byPriority = refPriority(a.ref) - refPriority(b.ref)
      if (byPriority !== 0) return byPriority
      return refDisplayLabel(a.ref).localeCompare(refDisplayLabel(b.ref))
    })
}

function branchToRef(branch: Branch): Ref {
  if (branch.kind === 'local') {
    const name = `refs/heads/${branch.name}`
    return {
      type: 'localBranch',
      name,
      label: formatRefLabel(name, 'localBranch'),
      isHead: false,
    }
  }
  const remote = branch.remote ?? 'origin'
  const name = `refs/remotes/${remote}/${branch.name}`
  return {
    type: 'remoteBranch',
    name,
    label: formatRefLabel(name, 'remoteBranch'),
    isHead: false,
  }
}

function branchPriority(branch: Branch): number {
  if (branch.isCurrent) return 0
  if (branch.kind === 'local') return 1
  return 2
}

function previewFromBranch(
  branch: Branch,
  branches: Branch[],
): BranchPreview {
  const ref = branchToRef(branch)
  const label = refDisplayLabel(ref)
  const sameLabel = branches.filter((b) => refDisplayLabel(branchToRef(b)) === label)
  return {
    ref,
    ...branchPresence(sameLabel.map(branchToRef)),
  }
}

function fallbackFromBranches(
  lane: number,
  commits: Commit[],
  layout: GraphLayout,
  branches: Branch[],
): BranchPreview | null {
  const tipIndexBySha = new Map(commits.map((c, i) => [c.sha, i]))
  const candidates = branches.filter((branch) => {
    const tipIndex = tipIndexBySha.get(branch.tipSha)
    if (tipIndex === undefined) return false
    return layout.nodes[tipIndex]?.lane === lane
  })
  if (candidates.length === 0) return null
  candidates.sort((a, b) => {
    const byPriority = branchPriority(a) - branchPriority(b)
    if (byPriority !== 0) return byPriority
    return a.name.localeCompare(b.name)
  })
  return previewFromBranch(candidates[0]!, branches)
}

/** Finds the branch whose tip sits on the same graph lane as the given commit. */
export function findLaneBranchPreview(
  commitIndex: number,
  commits: Commit[],
  layout: GraphLayout,
  branches: Branch[] = [],
): BranchPreview | null {
  if (commitIndex < 0 || commitIndex >= commits.length) return null
  const lane = layout.nodes[commitIndex]?.lane
  if (lane === undefined) return null

  for (let j = commitIndex - 1; j >= 0; j--) {
    if (layout.nodes[j]?.lane !== lane) continue
    const previews = branchRefsFromCommit(commits[j]!)
    if (previews.length > 0) return previews[0]!
  }

  for (let j = commitIndex + 1; j < commits.length; j++) {
    if (layout.nodes[j]?.lane !== lane) continue
    const previews = branchRefsFromCommit(commits[j]!)
    if (previews.length > 0) return previews[0]!
  }

  return fallbackFromBranches(lane, commits, layout, branches)
}
