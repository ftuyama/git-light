export type MergeMode = 'default' | 'ff-only' | 'no-ff' | 'squash'

export const MERGE_MODE_OPTIONS: { value: MergeMode; label: string; description: string }[] = [
  {
    value: 'default',
    label: 'Default',
    description: 'Fast-forward when possible, otherwise create a merge commit',
  },
  {
    value: 'ff-only',
    label: 'Fast-forward only',
    description: 'Refuse to merge unless a fast-forward is possible',
  },
  {
    value: 'no-ff',
    label: 'No fast-forward',
    description: 'Always create a merge commit',
  },
  {
    value: 'squash',
    label: 'Squash',
    description: 'Squash all commits from the source branch into one commit',
  },
]

export function mergeMetaForMode(mode: MergeMode): Record<string, boolean> {
  switch (mode) {
    case 'ff-only':
      return { ffOnly: true }
    case 'no-ff':
      return { noFf: true }
    case 'squash':
      return { squash: true }
    default:
      return {}
  }
}
