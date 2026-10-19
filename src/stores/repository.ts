import { defineStore } from 'pinia'
import { EMPTY_LAYOUT, EMPTY_PAGE } from './repo/graphLayout'
import { repositoryGetters } from './repo/getters'
import { lifecycleActions } from './repo/lifecycle'
import { gitActions } from './repo/gitActions'
import { commitBoxActions } from './repo/commitBox'
import type { RepositoryState } from './repo/types'

export const useRepositoryStore = defineStore('repository', {
  state: (): RepositoryState => ({
    screen: 'startup',
    loading: false,
    pendingRepoPath: null,
    refreshing: false,
    branchSwitching: false,
    repository: null,
    commits: [],
    commitPage: { ...EMPTY_PAGE },
    loadingMoreCommits: false,
    branches: [],
    tags: [],
    stashes: [],
    worktrees: [],
    workingTree: [],
    layout: EMPTY_LAYOUT,
    operation: null,
    operationPhase: null,
    busyAction: null,
    canCancel: false,
    commitMessage: '',
    commitDescription: '',
    amend: false,
    preAmendDraft: null,
    recentRepos: [],
    searchOpen: false,
    commitAuthor: null,
  }),
  getters: repositoryGetters,
  actions: {
    ...lifecycleActions,
    ...gitActions,
    ...commitBoxActions,
  },
})
