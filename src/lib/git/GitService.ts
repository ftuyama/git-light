import type { ActionResult, GitAction, RepositoryData } from '@/types/git'

/**
 * Abstraction over all data and mutations the UI needs. The renderer never
 * talks to git directly; it depends only on this interface. A real
 * implementation (git CLI via IPC, libgit2, or isomorphic-git) can be swapped
 * in without touching any component.
 */
export interface GitService {
  load(): Promise<RepositoryData>
  execute(action: GitAction): Promise<ActionResult>
}
