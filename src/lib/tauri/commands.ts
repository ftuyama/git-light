import type {
  CloneRepoRequest,
  DiscoverReposRequest,
  DiscoveredRepo,
  InitRepoRequest,
  OpenRepoResult,
  RecentRepository,
  SnapshotOptions,
} from '@shared/git/models'
import { defaultInvoke, type InvokeFn } from './invoke'

/**
 * Typed Tauri `invoke` wrappers. Command names are snake_case Tauri commands;
 * payloads keep the same JSON shape as the `shared/git` wire models 1:1.
 */
export async function tauriPing(
  value: string | undefined,
  invoker: InvokeFn = defaultInvoke,
): Promise<string | null> {
  return (await invoker('ping', { value })) as string | null
}

export async function tauriGitVersion(invoker: InvokeFn = defaultInvoke): Promise<string> {
  const result = (await invoker('git_version', undefined)) as { version: string }
  return result.version
}

export async function tauriRecentRepos(
  invoker: InvokeFn = defaultInvoke,
): Promise<RecentRepository[]> {
  return (await invoker('git_recent_repos', undefined)) as RecentRepository[]
}

export async function tauriOpenRepo(
  req: { path: string; options?: SnapshotOptions },
  invoker: InvokeFn = defaultInvoke,
): Promise<OpenRepoResult> {
  return (await invoker('git_open_repo', { path: req.path, options: req.options })) as OpenRepoResult
}

export async function tauriCloneRepo(
  req: { request: CloneRepoRequest; options?: SnapshotOptions },
  invoker: InvokeFn = defaultInvoke,
): Promise<OpenRepoResult> {
  return (await invoker('git_clone_repo', {
    request: req.request,
    options: req.options,
  })) as OpenRepoResult
}

export async function tauriInitRepo(
  req: { request: InitRepoRequest; options?: SnapshotOptions },
  invoker: InvokeFn = defaultInvoke,
): Promise<OpenRepoResult> {
  return (await invoker('git_init_repo', {
    request: req.request,
    options: req.options,
  })) as OpenRepoResult
}

export async function tauriDiscoverRepos(
  req: DiscoverReposRequest,
  invoker: InvokeFn = defaultInvoke,
): Promise<DiscoveredRepo[]> {
  return (await invoker('git_discover_repos', { request: req })) as DiscoveredRepo[]
}
