import { describe, expect, it, vi } from 'vitest'
import type { InvokeFn, ListenFn } from './invoke'
import { TauriTerminal, type TerminalDataEvent } from './terminal'

function setup() {
  const invoker: InvokeFn = vi.fn(async () => ({ id: 'session-1', shell: 'zsh' }))
  const handlers = new Map<string, (e: { payload: unknown }) => void>()
  const listenFn: ListenFn = vi.fn(async (event, handler) => {
    handlers.set(event, handler as (e: { payload: unknown }) => void)
    return () => {
      handlers.delete(event)
    }
  })
  return { service: new TauriTerminal(invoker, listenFn), invoker, handlers }
}

describe('TauriTerminal', () => {
  it('opens a session with the repo path and initial grid size', async () => {
    const { service, invoker } = setup()
    await expect(service.open('/repo', 100, 30)).resolves.toEqual({
      id: 'session-1',
      shell: 'zsh',
    })
    expect(invoker).toHaveBeenCalledWith('terminal_open', {
      cwd: '/repo',
      cols: 100,
      rows: 30,
    })
  })

  it('writes input, resizes and closes a session', async () => {
    const { service, invoker } = setup()
    await service.write('session-1', 'git status\n')
    await service.resize('session-1', 120, 40)
    await service.close('session-1')
    expect(invoker).toHaveBeenNthCalledWith(1, 'terminal_write', {
      id: 'session-1',
      data: 'git status\n',
    })
    expect(invoker).toHaveBeenNthCalledWith(2, 'terminal_resize', {
      id: 'session-1',
      cols: 120,
      rows: 40,
    })
    expect(invoker).toHaveBeenNthCalledWith(3, 'terminal_close', { id: 'session-1' })
  })

  it('forwards terminal:data payloads and unsubscribes', async () => {
    const { service, handlers } = setup()
    const received: TerminalDataEvent[] = []
    const unlisten = await service.onData((event) => received.push(event))
    handlers.get('terminal:data')?.({ payload: { id: 'session-1', data: 'aGk=' } })
    expect(received).toEqual([{ id: 'session-1', data: 'aGk=' }])
    unlisten()
    expect(handlers.has('terminal:data')).toBe(false)
  })
})
