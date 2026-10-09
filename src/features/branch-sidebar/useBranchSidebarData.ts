import { computed, type Ref } from 'vue'
import { isHeadBranch } from '@/lib/git/headRef'
import { sortCurrentBranchFirst } from './sortBranches'
import { useRepositoryStore } from '@/stores/repository'
import type { Branch } from '@/types/git'

export function useBranchSidebarData(query: Ref<string>) {
  const repo = useRepositoryStore()

  const normalizedQuery = computed(() => query.value.trim().toLowerCase())

  const filteredLocal = computed(() => {
    const visible = repo.localBranches.filter((b) => !isHeadBranch(b))
    const branches = normalizedQuery.value
      ? visible.filter((b) => b.name.toLowerCase().includes(normalizedQuery.value))
      : visible
    return sortCurrentBranchFirst(branches)
  })

  const rootBranches = computed(() => filteredLocal.value.filter((b) => b.group === ''))

  const groupedBranches = computed(() => {
    const groups = new Map<string, Branch[]>()
    for (const branch of filteredLocal.value) {
      if (branch.group === '') continue
      const list = groups.get(branch.group) ?? []
      list.push(branch)
      groups.set(branch.group, list)
    }
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, branches]) => [group, sortCurrentBranchFirst(branches)] as const)
  })

  const remoteBranches = computed(() => {
    const visible = repo.remoteBranches.filter((b) => !isHeadBranch(b))
    return normalizedQuery.value
      ? visible.filter((b) => b.name.toLowerCase().includes(normalizedQuery.value))
      : visible
  })

  const groupedRemoteBranches = computed(() => {
    const groups = new Map<string, Branch[]>()
    for (const branch of remoteBranches.value) {
      const remote = branch.remote ?? ''
      const list = groups.get(remote) ?? []
      list.push(branch)
      groups.set(remote, list)
    }
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([remote, branches]) => [remote, sortCurrentBranchFirst(branches)] as const)
  })

  const hasLocalMatches = computed(() => {
    if (!normalizedQuery.value) return true
    return (
      filteredLocal.value.length > 0 ||
      remoteBranches.value.length > 0 ||
      repo.tags.some((t) => t.name.toLowerCase().includes(normalizedQuery.value)) ||
      repo.stashes.some((s) => s.message.toLowerCase().includes(normalizedQuery.value))
    )
  })

  return {
    repo,
    normalizedQuery,
    filteredLocal,
    rootBranches,
    groupedBranches,
    remoteBranches,
    groupedRemoteBranches,
    hasLocalMatches,
  }
}

export type BranchSidebarData = ReturnType<typeof useBranchSidebarData>
