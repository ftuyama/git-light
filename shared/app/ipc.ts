/** Non-git IPC channel identifiers (app shell, persistence, window events). */
export const AppIpcChannels = {
  storeGet: 'store:get',
  storeSet: 'store:set',
  openExternal: 'app:open-external',
  windowFocus: 'window:focus',
  windowBlur: 'window:blur',
  setWindowBackgroundColor: 'window:set-background-color',
  terminalCreate: 'terminal:create',
  terminalWrite: 'terminal:write',
  terminalResize: 'terminal:resize',
  terminalKill: 'terminal:kill',
  terminalData: 'terminal:data',
  terminalExit: 'terminal:exit',
} as const

export type AppIpcInvokeChannel =
  | typeof AppIpcChannels.storeGet
  | typeof AppIpcChannels.storeSet
  | typeof AppIpcChannels.openExternal
  | typeof AppIpcChannels.setWindowBackgroundColor
  | typeof AppIpcChannels.terminalCreate
  | typeof AppIpcChannels.terminalWrite
  | typeof AppIpcChannels.terminalResize
  | typeof AppIpcChannels.terminalKill

export type AppIpcPushChannel =
  | typeof AppIpcChannels.windowFocus
  | typeof AppIpcChannels.windowBlur
  | typeof AppIpcChannels.terminalData
  | typeof AppIpcChannels.terminalExit

/** Maps each invoke channel to its [request, response] tuple for type safety. */
export interface AppIpcContract {
  [AppIpcChannels.storeGet]: [{ key: string; fallback: unknown }, unknown]
  [AppIpcChannels.storeSet]: [{ key: string; value: unknown }, void]
  [AppIpcChannels.openExternal]: [{ url: string }, void]
  [AppIpcChannels.setWindowBackgroundColor]: [{ color: string }, void]
  [AppIpcChannels.terminalCreate]: [
    { id: string; cwd: string; cols: number; rows: number },
    { ok: boolean },
  ]
  [AppIpcChannels.terminalWrite]: [{ id: string; data: string }, void]
  [AppIpcChannels.terminalResize]: [{ id: string; cols: number; rows: number }, void]
  [AppIpcChannels.terminalKill]: [{ id: string }, void]
}
