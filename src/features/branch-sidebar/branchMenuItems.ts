import { Check, GitBranch, GitCompare, Link, Pencil, Star, Trash2 } from '@lucide/vue'
import type { MenuItem } from '@/components/ui/menu'
import type { Branch } from '@/types/git'
import type { useRepositoryStore } from '@/stores/repository'
import { translate } from '@/locales'

type RepositoryStore = ReturnType<typeof useRepositoryStore>

/** Minimal translator shape, so components can pass a locale-reactive `t`. */
export type TranslateFn = (key: string) => string

export function branchMenuItems(
  repo: RepositoryStore,
  branch: Branch,
  t: TranslateFn = translate,
): MenuItem[] {
  if (branch.kind === 'remote') {
    return [
      {
        label: t('branches.menu.checkoutLocal'),
        icon: Check,
        onSelect: () => repo.checkoutRemoteBranch(branch),
      },
      {
        label: t('branches.menu.deleteRemote'),
        icon: Trash2,
        danger: true,
        onSelect: () =>
          void repo.runAction({
            kind: 'delete-remote-branch',
            target: branch.remote ? `${branch.remote}/${branch.name}` : branch.name,
            meta: branch.remote ? { remote: branch.remote } : undefined,
          }),
      },
    ]
  }

  return [
    {
      label: t('branches.menu.checkout'),
      icon: Check,
      onSelect: () => repo.checkoutBranch(branch.name),
    },
    {
      label: t('branches.menu.createHere'),
      icon: GitBranch,
      onSelect: () => repo.createBranch(branch.name),
    },
    { separator: true },
    {
      label: t('common.actions.rename'),
      icon: Pencil,
      onSelect: () => repo.renameBranch(branch.name),
    },
    {
      label: t('branches.menu.setUpstream'),
      icon: Link,
      onSelect: () => repo.setUpstream(branch.name),
    },
    {
      label: t('branches.menu.compareWithCurrent'),
      icon: GitCompare,
      onSelect: () =>
        void repo.runAction({
          kind: 'compare-branches',
          target: branch.name,
          meta: { other: repo.currentBranch?.name },
        }),
    },
    {
      label: t(branch.isFavorite ? 'branches.menu.unpin' : 'branches.menu.pin'),
      icon: Star,
      onSelect: () => repo.toggleFavorite(branch.id),
    },
    { separator: true },
    {
      label: t('common.actions.delete'),
      icon: Trash2,
      danger: true,
      onSelect: () => repo.deleteBranch(branch.name),
    },
  ]
}
