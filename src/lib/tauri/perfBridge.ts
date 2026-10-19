import { addPerfSink, perfEnabled, type PerfEntry } from '@shared/perf'
import { isTauri } from '@/lib/backend'
import { defaultInvoke, type InvokeFn } from './invoke'

/**
 * Dev bridge that gets perf samples onto the terminal running `npm run dev`.
 *
 * The Tauri webview console is not piped to the terminal, so `console.log`
 * survives only in devtools. The sink forwards each sample to the Rust
 * `git_perf_log` command, which prints it on stderr — the same stream the rest
 * of the dev output uses.
 *
 * Exported for tests: the production entry point is `attachPerfToTerminal`.
 */
export function createTerminalPerfSink(
  invokeFn: InvokeFn = defaultInvoke,
): (entry: PerfEntry) => void {
  return (entry) => {
    void invokeFn('git_perf_log', { label: entry.label, ms: entry.ms }).catch(() => {
      /* The bridge is diagnostics only: never let it break a switch. */
    })
  }
}

/** Wires perf samples to the terminal. Returns the unsubscribe function. */
export function attachPerfToTerminal(): () => void {
  if (!perfEnabled() || !isTauri()) return () => {}
  return addPerfSink(createTerminalPerfSink())
}
