/** Lightweight timing helpers; active when `GIT_LIGHT_PERF=1` or in Vite dev. */
export function perfEnabled(): boolean {
  if (typeof process !== 'undefined' && process.env.GIT_LIGHT_PERF === '1') return true
  try {
    return Boolean(import.meta.env?.DEV)
  } catch {
    return false
  }
}

export async function perfAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!perfEnabled()) return fn()
  const start = performance.now()
  try {
    return await fn()
  } finally {
    console.log(`[git-light perf] ${label}: ${(performance.now() - start).toFixed(1)}ms`)
  }
}

export function perfSync<T>(label: string, fn: () => T): T {
  if (!perfEnabled()) return fn()
  const start = performance.now()
  try {
    return fn()
  } finally {
    console.log(`[git-light perf] ${label}: ${(performance.now() - start).toFixed(1)}ms`)
  }
}
