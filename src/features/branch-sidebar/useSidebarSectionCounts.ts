import type { SectionKey } from '@/lib/preferences'
import { useRepositoryStore } from '@/stores/repository'

/**
 * Row totals per sidebar section, independent of the search query. The
 * collapsed rail and the section headers both read from here so the numbers
 * stay in sync.
 */
export function useSidebarSectionCounts() {
  const repo = useRepositoryStore()

  function sectionCount(key: SectionKey): number {
    switch (key) {
      case 'favorites':
        return repo.favoriteBranches.length
      case 'localBranches':
        return repo.localBranches.length
      case 'remoteBranches':
        return repo.remoteBranches.length
      case 'tags':
        return repo.tags.length
      case 'stashes':
        return repo.stashes.length
      case 'worktrees':
        return repo.worktrees.length
    }
  }

  return { sectionCount }
}
