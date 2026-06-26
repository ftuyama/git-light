import type { Branch } from '@/types/git'

/** Puts the checked-out branch first in a sidebar list. */
export function sortCurrentBranchFirst(branches: Branch[]): Branch[] {
  const index = branches.findIndex((b) => b.isCurrent)
  if (index <= 0) return branches
  return [branches[index], ...branches.slice(0, index), ...branches.slice(index + 1)]
}
