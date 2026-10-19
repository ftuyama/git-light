/**
 * Backend repo readiness gate.
 *
 * The backend serves a single "current" repository. Switching to a tab that is
 * already cached paints its snapshot before `git_activate_repo` has answered,
 * so for the duration of that re-point the backend still serves the repository
 * the user just left. Anything repo-scoped issued in that window (a diff, a
 * blame, and above all a destructive action) would target the wrong repository.
 *
 * `markBackendRepoPending` publishes that re-point and `whenBackendRepoReady`
 * waits for it, which lets the IPC layer hold repo-scoped commands back until
 * the backend agrees with the tab the user is looking at.
 */

let pending: Promise<unknown> | null = null

/** Publishes an in-flight backend re-point; the gate opens when it settles. */
export function markBackendRepoPending<T>(promise: Promise<T>): Promise<T> {
  pending = promise
  const clear = () => {
    if (pending === promise) pending = null
  }
  void promise.then(clear, clear)
  return promise
}

/**
 * Resolves once the in-flight backend re-point has settled (immediately when
 * there is none). A failed re-point opens the gate too: the command that
 * follows reports its own error against the backend's actual state.
 */
export async function whenBackendRepoReady(): Promise<void> {
  const inFlight = pending
  if (!inFlight) return
  try {
    await inFlight
  } catch {
    /* the re-point's own caller reports the failure */
  }
}

/** Test hook: forget any pending re-point between cases. */
export function resetBackendGate(): void {
  pending = null
}
