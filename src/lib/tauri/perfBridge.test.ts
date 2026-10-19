import { describe, expect, it, vi } from 'vitest'
import { createTerminalPerfSink } from './perfBridge'

describe('perf terminal bridge', () => {
  it('forwards a sample to the Rust logger', async () => {
    const invoker = vi.fn(async () => undefined)
    const sink = createTerminalPerfSink(invoker)

    sink({ label: 'switch: click→painted', ms: 1234.56, at: Date.now() })

    expect(invoker).toHaveBeenCalledWith('git_perf_log', {
      label: 'switch: click→painted',
      ms: 1234.56,
    })
  })

  it('never rejects when the backend call fails', async () => {
    const invoker = vi.fn(async () => {
      throw new Error('not a tauri context')
    })
    const sink = createTerminalPerfSink(invoker)

    expect(() => sink({ label: 'switch: x', ms: 1, at: Date.now() })).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(invoker).toHaveBeenCalled()
  })
})
