import { defineStore } from 'pinia'
import type { Branch } from '@/types/git'

const BRANCH_MIME = 'application/x-git-light-branch'

export const useBranchDragStore = defineStore('branchDrag', {
  state: () => ({
    draggingId: null as string | null,
    dropTargetId: null as string | null,
    pendingIntegrate: null as { source: Branch; target: Branch } | null,
  }),
  actions: {
    startDrag(branchId: string): void {
      this.draggingId = branchId
    },
    clearDrag(): void {
      this.draggingId = null
      this.dropTargetId = null
    },
    setDropTarget(branchId: string | null): void {
      this.dropTargetId = branchId
    },
  },
})

export function setBranchDragPayload(dataTransfer: DataTransfer, branchId: string): void {
  dataTransfer.effectAllowed = 'move'
  dataTransfer.setData(BRANCH_MIME, branchId)
}

export function readBranchDragPayload(dataTransfer: DataTransfer): string | null {
  return dataTransfer.getData(BRANCH_MIME) || null
}

export function branchIntegrateLabel(branch: Branch): string {
  return branch.name
}
