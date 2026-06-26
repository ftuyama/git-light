import { reactive, ref } from 'vue'
import type { Branch } from '@/types/git'

const BRANCH_MIME = 'application/x-git-light-branch'

export const branchDragState = reactive({
  draggingId: null as string | null,
  dropTargetId: null as string | null,
})

export const pendingBranchIntegrate = ref<{ source: Branch; target: Branch } | null>(null)

export function branchDragMime(): string {
  return BRANCH_MIME
}

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
