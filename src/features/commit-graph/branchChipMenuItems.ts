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
import { githubBranchUrl, githubCommitUrl } from '@shared/git/githubUrl'

type RepositoryStore = ReturnType<typeof useRepositoryStore>

export interface BranchChipMenuOptions {
  /** Commit the chip is rendered on (the branch tip for that row). */
  commitSha?: string
  /** Show power-user entries (interactive rebase, cherry pick, tags). */
  advanced?: boolean
}

/** Full ref name used for git commands: `origin/feature` for remote branches. */
export function branchRefName(branch: Branch): string {
  return branch.kind === 'remote' && branch.remote ? `${branch.remote}/${branch.name}` : branch.name
}

async function copyText(text: string, label: string): Promise<void> {
  const toast = useToastStore()
  if (!navigator.clipboard) {
    toast.push('Clipboard is not available', 'error')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    toast.push(`Copied ${label}`, 'info')
  } catch {
    toast.push('Could not copy to clipboard', 'error')
  }
}

async function copyLink(url: string | null): Promise<void> {
  const toast = useToastStore()
  if (!url) {
    toast.push('No GitHub remote configured for this repository', 'error')
    return
  }
  await copyText(url, 'link')
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
      label: isRemote ? 'Checkout Local Branch' : 'Checkout',
      icon: Check,
      onSelect: () =>
        isRemote ? repo.checkoutRemoteBranch(branch) : repo.checkoutBranch(branch.name),
    })
  }

  items.push(
    {
      label: 'Create Branch Here',
      icon: GitBranch,
      onSelect: () => repo.beginCreateBranch({ startPoint: fullName, sha }),
    },
    {
      label: 'Create Worktree from Branch',
      icon: FolderGit2,
      onSelect: () => void repo.addWorktree(fullName),
    },
  )

  if (!isCurrent) {
    items.push(
      { separator: true },
      {
        label: 'Merge into Current',
        icon: GitMerge,
        onSelect: () => void repo.runAction({ kind: 'merge', target: fullName }),
      },
      {
        label: 'Rebase Current onto This',
        icon: Spline,
        onSelect: () => void repo.runAction({ kind: 'rebase', target: fullName }),
      },
    )
  }

  if (options.advanced) {
    items.push({
      label: 'Interactive Rebase onto This…',
      icon: ListTree,
      onSelect: () => useInteractiveRebaseStore().openAtBase(fullName),
    })
    if (sha && !isCurrent) {
      items.push({
        label: 'Cherry Pick Tip Commit',
        icon: Cherry,
        onSelect: () => void repo.runAction({ kind: 'cherry-pick', target: sha }),
      })
    }
  }

  const copyItems: MenuItem[] = [
    {
      label: 'Copy Branch Name',
      onSelect: () => void copyText(fullName, 'branch name'),
    },
  ]
  if (sha) {
    copyItems.push(
      {
        label: 'Copy Tip Commit SHA',
        onSelect: () => void copyText(sha, 'commit SHA'),
      },
      {
        label: 'Copy Link to Commit on GitHub',
        onSelect: () => void copyLink(githubCommitUrl(remoteUrl, sha)),
      },
    )
  }
  copyItems.push({
    label: 'Copy Link to Branch on GitHub',
    onSelect: () => void copyLink(githubBranchUrl(remoteUrl, branch.name)),
  })

  items.push({ separator: true }, { label: 'Copy', icon: Copy, children: copyItems })

  items.push({ separator: true })

  if (!isCurrent) {
    items.push({
      label: 'Compare with Current',
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
        label: 'Set Upstream…',
        icon: LinkIcon,
        onSelect: () => void repo.setUpstream(branch.name),
      },
      {
        label: 'Rename…',
        icon: Pencil,
        onSelect: () => void repo.renameBranch(branch.name),
      },
    )
    if (isKnownBranch) {
      items.push({
        label: branch.isFavorite ? 'Unpin from Favorites' : 'Pin to Favorites',
        icon: Star,
        onSelect: () => repo.toggleFavorite(branch.id),
      })
    }
  }

  if (options.advanced && sha) {
    items.push(
      { separator: true },
      {
        label: 'Create Tag Here…',
        icon: TagIcon,
        onSelect: () => void repo.createTagAt(sha),
      },
    )
  }

  items.push(
    { separator: true },
    isRemote
      ? {
          label: 'Delete Remote Branch',
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
          label: 'Delete Branch',
          icon: Trash2,
          danger: true,
          onSelect: () => void repo.deleteBranch(branch.name),
        },
  )

  return items
}
