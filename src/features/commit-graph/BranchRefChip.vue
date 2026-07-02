<script setup lang="ts">
import { computed } from 'vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import RefChip from './RefChip.vue'
import { branchMenuItems } from '@/features/branch-sidebar/branchMenuItems'
import { branchFromRef } from '@/features/branch-sidebar/branchRefUtils'
import type { Ref } from '@/types/git'
import { useRepositoryStore } from '@/stores/repository'

const props = defineProps<{
  refData: Ref
  color: string
  hasLocal?: boolean
  hasRemote?: boolean
  muted?: boolean
}>()

const repo = useRepositoryStore()

const isBranchRef = computed(
  () => props.refData.type === 'localBranch' || props.refData.type === 'remoteBranch',
)

const menu = computed(() => {
  if (!isBranchRef.value) return null
  const branch = branchFromRef(props.refData, repo.branches)
  if (!branch) return null
  return branchMenuItems(repo, branch)
})
</script>

<template>
  <ContextMenu v-if="menu" :items="menu">
    <div class="min-w-0 max-w-full" @contextmenu.stop>
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
