<script setup lang="ts">
import { computed } from 'vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import RefChip from './RefChip.vue'
import { branchChipMenuItems } from './branchChipMenuItems'
import { branchFromRef } from '@/features/branch-sidebar/branchRefUtils'
import type { Ref } from '@/types/git'
import { useRepositoryStore } from '@/stores/repository'
import { useUiStore } from '@/stores/ui'

const props = defineProps<{
  refData: Ref
  color: string
  /** Commit SHA of the row the chip sits on (the branch tip for tip chips). */
  commitSha?: string
  hasLocal?: boolean
  hasRemote?: boolean
  muted?: boolean
}>()

const repo = useRepositoryStore()
const ui = useUiStore()

const isBranchRef = computed(
  () => props.refData.type === 'localBranch' || props.refData.type === 'remoteBranch',
)

const menu = computed(() => {
  if (!isBranchRef.value) return null
  const branch = branchFromRef(props.refData, repo.branches)
  if (!branch) return null
  return branchChipMenuItems(repo, branch, {
    commitSha: props.commitSha,
    advanced: ui.isAdvanced,
  })
})
</script>

<template>
  <ContextMenu v-if="menu" :items="menu">
    <div class="w-fit min-w-0 max-w-full" @contextmenu.stop>
      <RefChip
        :ref-data="refData"
        :color="color"
        :has-local="hasLocal"
        :has-remote="hasRemote"
        :muted="muted"
      />
    </div>
  </ContextMenu>
  <RefChip
    v-else
    :ref-data="refData"
    :color="color"
    :has-local="hasLocal"
    :has-remote="hasRemote"
    :muted="muted"
  />
</template>
