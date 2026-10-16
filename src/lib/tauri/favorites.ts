import { defaultInvoke, type InvokeFn } from './invoke'

/** Pinned-branch names for one repository (mirrors `branch-favorites:{path}`). */
export async function loadBranchFavorites(
  repoPath: string,
  invoker: InvokeFn = defaultInvoke,
): Promise<string[]> {
  return (await invoker('git_get_favorites', { request: { repoPath } })) as string[]
}

/** Persist pinned-branch names for one repository. */
export async function saveBranchFavorites(
  repoPath: string,
  names: string[],
  invoker: InvokeFn = defaultInvoke,
): Promise<string[]> {
  return (await invoker('git_set_favorites', { request: { repoPath, names } })) as string[]
}
