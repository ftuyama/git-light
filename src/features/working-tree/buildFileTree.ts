import type { WorkingTreeFile } from '@/types/git'

export interface FileTreeFolder {
  kind: 'folder'
  name: string
  path: string
  children: FileTreeNode[]
}

export interface FileTreeFile {
  kind: 'file'
  file: WorkingTreeFile
}

export type FileTreeNode = FileTreeFolder | FileTreeFile

export function buildFileTree(files: WorkingTreeFile[]): FileTreeNode[] {
  const root: FileTreeFolder = { kind: 'folder', name: '', path: '', children: [] }

  for (const file of files) {
    const parts = file.path.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const segmentPath = parts.slice(0, i + 1).join('/')

      if (isFile) {
        current.children.push({ kind: 'file', file })
        continue
      }

      let folder = current.children.find(
        (child): child is FileTreeFolder => child.kind === 'folder' && child.name === part,
      )
      if (!folder) {
        folder = { kind: 'folder', name: part, path: segmentPath, children: [] }
        current.children.push(folder)
      }
      current = folder
    }
  }

  return sortTreeNodes(root.children)
}

function sortTreeNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
    const aName = a.kind === 'folder' ? a.name : a.file.fileName
    const bName = b.kind === 'folder' ? b.name : b.file.fileName
    return aName.localeCompare(bName)
  }).map((node) =>
    node.kind === 'folder' ? { ...node, children: sortTreeNodes(node.children) } : node,
  )
}

export interface FlatTreeRow {
  kind: 'folder' | 'file'
  depth: number
  folder?: FileTreeFolder
  file?: WorkingTreeFile
}

export function flattenFileTree(
  nodes: FileTreeNode[],
  collapsed: Set<string>,
  depth = 0,
): FlatTreeRow[] {
  const rows: FlatTreeRow[] = []

  for (const node of nodes) {
    if (node.kind === 'file') {
      rows.push({ kind: 'file', depth, file: node.file })
      continue
    }

    rows.push({ kind: 'folder', depth, folder: node })
    if (!collapsed.has(node.path)) {
      rows.push(...flattenFileTree(node.children, collapsed, depth + 1))
    }
  }

  return rows
}
