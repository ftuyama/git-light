import {
  Check,
  Cherry,
  Copy,
  FolderGit2,
  GitBranch,
  GitCompare,
  GitMerge,
  Link as LinkIcon,
  ListTree,
  Pencil,
  Spline,
  Star,
  Tag as TagIcon,
  Trash2,
} from '@lucide/vue'
import type { MenuItem } from '@/components/ui/menu'
import type { Branch } from '@/types/git'
import type { useRepositoryStore } from '@/stores/repository'
import { useInteractiveRebaseStore } from '@/stores/interactiveRebase'
import { useToastStore } from '@/stores/toast'
import { translate } from '@/locales'
import { githubBranchUrl, githubCommitUrl } from '@shared/git/githubUrl'

type RepositoryStore = ReturnType<typeof useRepositoryStore>

export interface BranchChipMenuOptions {
  /** Commit the chip is rendered on (the branch tip for that row). */
  commitSha?: string
  /** Show power-user entries (interactive rebase, cherry pick, tags). */
  advanced?: boolean
}

/** Full ref name used for git commands: `origin/feature` for remote branches. */
function branchRefName(branch: Branch): string {
  return branch.kind === 'remote' && branch.remote ? `${branch.remote}/${branch.name}` : branch.name
}

async function copyText(text: string, targetKey: string): Promise<void> {
  const toast = useToastStore()
  if (!navigator.clipboard) {
    toast.push(translate('graph.toast.clipboardUnavailable'), 'error')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    toast.push(
      translate('graph.toast.copied', { target: translate(targetKey) }),
      'info',
    )
  } catch {
    toast.push(translate('graph.toast.copyFailed'), 'error')
  }
}

async function copyLink(url: string | null): Promise<void> {
  const toast = useToastStore()
  if (!url) {
    toast.push(translate('graph.toast.noGithubRemote'), 'error')
    return
  }
  await copyText(url, 'graph.copyTarget.link')
}

export function branchChipMenuItems(
  repo: RepositoryStore,
  branch: Branch,
  options: BranchChipMenuOptions = {},
): MenuItem[] {
  const fullName = branchRefName(branch)
  const sha = options.commitSha || branch.tipSha
  const currentName = repo.currentBranch?.name
  const remoteUrl = repo.repository?.remoteUrl ?? ''
  const isRemote = branch.kind === 'remote'
  const isCurrent = branch.isCurrent
  const isKnownBranch = repo.branches.some((b) => b.id === branch.id)

  const items: MenuItem[] = []

  if (!isCurrent) {
    items.push({
      label: isRemote
        ? translate('graph.branchMenu.checkoutLocal')
        : translate('graph.branchMenu.checkout'),
      icon: Check,
      onSelect: () =>
        isRemote ? repo.checkoutRemoteBranch(branch) : repo.checkoutBranch(branch.name),
    })
  }

  items.push(
    {
      label: translate('graph.branchMenu.createBranch'),
      icon: GitBranch,
      onSelect: () => repo.beginCreateBranch({ startPoint: fullName, sha }),
    },
    {
      label: translate('graph.branchMenu.createWorktree'),
      icon: FolderGit2,
      onSelect: () => void repo.addWorktree(fullName),
    },
  )

  if (!isCurrent) {
    items.push(
      { separator: true },
      {
        label: translate('graph.branchMenu.mergeIntoCurrent'),
        icon: GitMerge,
        onSelect: () => void repo.runAction({ kind: 'merge', target: fullName }),
      },
      {
        label: translate('graph.branchMenu.rebaseCurrentOntoThis'),
        icon: Spline,
        onSelect: () => void repo.runAction({ kind: 'rebase', target: fullName }),
      },
    )
  }

  if (options.advanced) {
    items.push({
      label: translate('graph.branchMenu.interactiveRebaseOntoThis'),
      icon: ListTree,
      onSelect: () => useInteractiveRebaseStore().openAtBase(fullName),
    })
    if (sha && !isCurrent) {
      items.push({
        label: translate('graph.branchMenu.cherryPickTip'),
        icon: Cherry,
        onSelect: () => void repo.runAction({ kind: 'cherry-pick', target: sha }),
      })
    }
  }

  const copyItems: MenuItem[] = [
    {
      label: translate('graph.branchMenu.copyBranchName'),
      onSelect: () => void copyText(fullName, 'graph.copyTarget.branchName'),
    },
  ]
  if (sha) {
    copyItems.push(
      {
        label: translate('graph.branchMenu.copyTipSha'),
        onSelect: () => void copyText(sha, 'graph.copyTarget.commitSha'),
      },
      {
        label: translate('graph.branchMenu.copyCommitLink'),
        onSelect: () => void copyLink(githubCommitUrl(remoteUrl, sha)),
      },
    )
  }
  copyItems.push({
    label: translate('graph.branchMenu.copyBranchLink'),
    onSelect: () => void copyLink(githubBranchUrl(remoteUrl, branch.name)),
  })

  items.push(
    { separator: true },
    { label: translate('graph.branchMenu.copy'), icon: Copy, children: copyItems },
  )

  items.push({ separator: true })

  if (!isCurrent) {
    items.push({
      label: translate('graph.branchMenu.compareWithCurrent'),
      icon: GitCompare,
      onSelect: () =>
        void repo.runAction({
          kind: 'compare-branches',
          target: fullName,
          meta: currentName ? { other: currentName } : undefined,
        }),
    })
  }

  if (!isRemote) {
    items.push(
      {
        label: translate('graph.branchMenu.setUpstream'),
        icon: LinkIcon,
        onSelect: () => void repo.setUpstream(branch.name),
      },
      {
        label: translate('graph.branchMenu.rename'),
        icon: Pencil,
        onSelect: () => void repo.renameBranch(branch.name),
      },
    )
    if (isKnownBranch) {
      items.push({
        label: branch.isFavorite
          ? translate('graph.branchMenu.unpin')
          : translate('graph.branchMenu.pin'),
        icon: Star,
        onSelect: () => repo.toggleFavorite(branch.id),
      })
    }
  }

  if (options.advanced && sha) {
    items.push(
      { separator: true },
      {
        label: translate('graph.branchMenu.createTag'),
        icon: TagIcon,
        onSelect: () => void repo.createTagAt(sha),
      },
    )
  }

  items.push(
    { separator: true },
    isRemote
      ? {
          label: translate('graph.branchMenu.deleteRemote'),
          icon: Trash2,
          danger: true,
          onSelect: () =>
            void repo.runAction({
              kind: 'delete-remote-branch',
              target: fullName,
              meta: branch.remote ? { remote: branch.remote } : undefined,
            }),
        }
      : {
          label: translate('graph.branchMenu.delete'),
          icon: Trash2,
          danger: true,
          onSelect: () => void repo.deleteBranch(branch.name),
        },
  )

  return items
}
