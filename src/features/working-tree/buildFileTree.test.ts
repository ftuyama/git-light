import { describe, expect, it } from 'vitest'
import { buildFileTree, flattenFileTree } from './buildFileTree'
import type { WorkingTreeFile } from '@/types/git'

function file(path: string): WorkingTreeFile {
  const idx = path.lastIndexOf('/')
  return {
    id: path,
    path,
    fileName: idx === -1 ? path : path.slice(idx + 1),
    directory: idx === -1 ? '' : path.slice(0, idx),
    status: 'modified',
    staged: false,
    additions: 1,
    deletions: 0,
  }
}

describe('buildFileTree', () => {
  it('groups files by folder', () => {
    const tree = buildFileTree([file('src/a.ts'), file('src/b.ts'), file('README.md')])

    expect(tree).toHaveLength(2)
    expect(tree[0]).toMatchObject({ kind: 'folder', name: 'src' })
    expect(tree[1]).toMatchObject({ kind: 'file', file: { path: 'README.md' } })
    if (tree[0].kind === 'folder') {
      expect(tree[0].children).toHaveLength(2)
    }
  })

  it('flattens folders expanded by default', () => {
    const tree = buildFileTree([file('src/a.ts'), file('src/b.ts')])
    const expanded = flattenFileTree(tree, new Set())
    expect(expanded).toHaveLength(3)

    const collapsed = flattenFileTree(tree, new Set(['src']))
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0].kind).toBe('folder')
  })
})
