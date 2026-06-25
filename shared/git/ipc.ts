import type { GitAction } from './actions'
import type {
  ActionEnvelope,
  CommitPageRequest,
  CommitPageResult,
  DiffRequest,
  DiffResult,
  OpenRepoResult,
  RecentRepository,
  SearchQuery,
  SearchResults,
  SnapshotOptions,
  WireRepositorySnapshot,
} from './models'

/** IPC channel identifiers. Grouped invoke (request/response) and push (events). */
export const IpcChannels = {
  openRepo: 'git:open-repo',
  pickAndOpenRepo: 'git:pick-open-repo',
  closeRepo: 'git:close-repo',
  snapshot: 'git:snapshot',
  commitPage: 'git:commit-page',
  action: 'git:action',
  diff: 'git:diff',
  search: 'git:search',
  cancel: 'git:cancel',
  recentRepos: 'git:recent-repos',
  removeRecent: 'git:remove-recent',
  openTerminal: 'git:open-terminal',
  revealPath: 'git:reveal-path',
  // push channels (main -> renderer)
  changed: 'git:changed',
  progress: 'git:progress',
} as const

/** Maps each invoke channel to its [request, response] tuple for type safety. */
export interface IpcContract {
  [IpcChannels.openRepo]: [{ path: string; options?: SnapshotOptions }, OpenRepoResult]
  [IpcChannels.pickAndOpenRepo]: [{ options?: SnapshotOptions }, OpenRepoResult | { cancelled: true }]
  [IpcChannels.closeRepo]: [void, void]
  [IpcChannels.snapshot]: [{ options?: SnapshotOptions }, WireRepositorySnapshot]
  [IpcChannels.commitPage]: [CommitPageRequest, CommitPageResult]
  [IpcChannels.action]: [GitAction, ActionEnvelope]
  [IpcChannels.diff]: [DiffRequest, DiffResult]
  [IpcChannels.search]: [SearchQuery, SearchResults]
  [IpcChannels.cancel]: [void, void]
  [IpcChannels.recentRepos]: [void, RecentRepository[]]
  [IpcChannels.removeRecent]: [{ path: string }, RecentRepository[]]
  [IpcChannels.openTerminal]: [{ path?: string }, { ok: boolean }]
  [IpcChannels.revealPath]: [{ path: string }, void]
}
