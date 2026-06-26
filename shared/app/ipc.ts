/** Non-git IPC channel identifiers (app shell, persistence, window events). */
export const AppIpcChannels = {
  storeGet: 'store:get',
  storeSet: 'store:set',
  openExternal: 'app:open-external',
  windowFocus: 'window:focus',
  windowBlur: 'window:blur',
} as const

export type AppIpcInvokeChannel =
  | typeof AppIpcChannels.storeGet
  | typeof AppIpcChannels.storeSet
  | typeof AppIpcChannels.openExternal

export type AppIpcPushChannel =
  | typeof AppIpcChannels.windowFocus
  | typeof AppIpcChannels.windowBlur

/** Maps each invoke channel to its [request, response] tuple for type safety. */
export interface AppIpcContract {
  [AppIpcChannels.storeGet]: [{ key: string; fallback: unknown }, unknown]
  [AppIpcChannels.storeSet]: [{ key: string; value: unknown }, void]
  [AppIpcChannels.openExternal]: [{ url: string }, void]
}
