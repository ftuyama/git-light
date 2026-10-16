import { invoke } from '@tauri-apps/api/core'
import { listen, type Event } from '@tauri-apps/api/event'

/** Injectable Tauri IPC primitives (fakes in tests, real runtime in app). */
export type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>

export type ListenFn = <T>(event: string, handler: (e: Event<T>) => void) => Promise<() => void>

export const defaultInvoke: InvokeFn = (cmd, args) => invoke(cmd, args)

export const defaultListen: ListenFn = (event, handler) => listen(event, handler)
