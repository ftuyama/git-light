export type MergeMode = 'default' | 'ff-only' | 'no-ff' | 'squash'

/**
 * Merge strategies offered when integrating branches. The copy lives in the
 * `branches.mergeModes.*` catalog so the dialog can translate it at render time.
 */
export const MERGE_MODE_OPTIONS: {
  value: MergeMode
  labelKey: string
  descriptionKey: string
}[] = [
  {
    value: 'default',
    labelKey: 'branches.mergeModes.default.label',
    descriptionKey: 'branches.mergeModes.default.description',
  },
  {
    value: 'ff-only',
    labelKey: 'branches.mergeModes.ffOnly.label',
    descriptionKey: 'branches.mergeModes.ffOnly.description',
  },
  {
    value: 'no-ff',
    labelKey: 'branches.mergeModes.noFf.label',
    descriptionKey: 'branches.mergeModes.noFf.description',
  },
  {
    value: 'squash',
    labelKey: 'branches.mergeModes.squash.label',
    descriptionKey: 'branches.mergeModes.squash.description',
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
