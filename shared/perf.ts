/**
 * Lightweight timing helpers; active in Vite dev (or when `GIT_LIGHT_PERF=1`
 * is visible to the bundler).
 *
 * The Tauri webview console is not piped to the terminal, so `console.log`
 * alone is invisible during development: `setPerfSink` lets the on-screen
 * `PerfOverlay` show the same samples.
 */
export interface PerfEntry {
  label: string
  ms: number
  at: number
}

type PerfSink = (entry: PerfEntry) => void

const sinks = new Set<PerfSink>()

/**
 * Subscribes to perf samples (the dev terminal bridge and/or an on-screen
 * overlay). Returns the unsubscribe function.
 */
export function addPerfSink(sink: PerfSink): () => void {
  sinks.add(sink)
  return () => sinks.delete(sink)
}

export function perfEnabled(): boolean {
  if (typeof process !== 'undefined' && process.env.GIT_LIGHT_PERF === '1') return true
  try {
    return Boolean(import.meta.env?.DEV)
  } catch {
    return false
  }
}

/** Records an already-measured sample (same channel as `perfSync`). */
export function perfRecord(label: string, ms: number): void {
  if (!perfEnabled()) return
  const entry: PerfEntry = { label, ms, at: Date.now() }
  console.log(`[git-light perf] ${label}: ${ms.toFixed(1)}ms`)
  for (const sink of sinks) sink(entry)
}

export async function perfAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!perfEnabled()) return fn()
  const start = performance.now()
  try {
    return await fn()
  } finally {
    perfRecord(label, performance.now() - start)
  }
}

export function perfSync<T>(label: string, fn: () => T): T {
  if (!perfEnabled()) return fn()
  const start = performance.now()
  try {
    return fn()
  } finally {
    perfRecord(label, performance.now() - start)
  }
}
