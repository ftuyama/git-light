import { Check, GitBranch, GitCompare, Link, Pencil, Star, Trash2 } from '@lucide/vue'
import type { MenuItem } from '@/components/ui/menu'
import type { Branch } from '@/types/git'
import type { useRepositoryStore } from '@/stores/repository'

type RepositoryStore = ReturnType<typeof useRepositoryStore>

export function branchMenuItems(repo: RepositoryStore, branch: Branch): MenuItem[] {
  if (branch.kind === 'remote') {
    return [
      {
        label: 'Checkout Local Branch',
        icon: Check,
        onSelect: () => repo.checkoutRemoteBranch(branch),
      },
      {
        label: 'Delete Remote Branch',
        icon: Trash2,
        danger: true,
        onSelect: () =>
          void repo.runAction({ kind: 'delete-remote-branch', target: branch.name }),
      },
    ]
  }

  return [
    { label: 'Checkout', icon: Check, onSelect: () => repo.checkoutBranch(branch.name) },
    {
      label: 'Create Branch Here',
      icon: GitBranch,
      onSelect: () => repo.createBranch(branch.name),
    },
    { separator: true },
    { label: 'Rename', icon: Pencil, onSelect: () => repo.renameBranch(branch.name) },
    { label: 'Set Upstream', icon: Link, onSelect: () => repo.setUpstream(branch.name) },
    {
      label: 'Compare with Current',
      icon: GitCompare,
      onSelect: () =>
        void repo.runAction({
          kind: 'compare-branches',
          target: branch.name,
          meta: { other: repo.currentBranch?.name },
        }),
    },
    {
      label: branch.isFavorite ? 'Unpin' : 'Pin to Favorites',
      icon: Star,
      onSelect: () => repo.toggleFavorite(branch.id),
    },
    { separator: true },
    {
      label: 'Delete',
      icon: Trash2,
      danger: true,
      onSelect: () => repo.deleteBranch(branch.name),
    },
  ]
}
