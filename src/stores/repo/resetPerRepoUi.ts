import { useInteractiveRebaseStore } from '@/stores/interactiveRebase'
import { useRepoDiffStore } from '@/stores/repoDiff'
import { useSelectionStore } from '@/stores/selection'
import { resetDiffReloadScheduler } from './diffReloadScheduler'

export function resetPerRepoUiState(): void {
  useSelectionStore().cancelBranchCreation()
  useSelectionStore().select(null)
  useRepoDiffStore().resetOnRepoClose()
  resetDiffReloadScheduler()
  useInteractiveRebaseStore().close()
}
