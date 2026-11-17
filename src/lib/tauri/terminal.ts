import { defaultInvoke, defaultListen, type InvokeFn, type ListenFn } from './invoke'

export interface TerminalSessionInfo {
  id: string
  /** File name of the shell that was started, e.g. `zsh`. */
  shell: string
}

export interface TerminalDataEvent {
  id: string
  /** Base64-encoded PTY output; bytes are decoded by the xterm view. */
  data: string
}

export interface TerminalExitEvent {
  id: string
}

/**
 * Thin typed wrapper around the PTY commands in `src-tauri/src/terminal.rs`.
 * Kept separate from `GitService`: a shell is not a git operation and the
 * terminal keeps its own session lifecycle.
 */
export class TauriTerminal {
  private readonly invokeFn: InvokeFn
  private readonly listenFn: ListenFn

  constructor(invokeFn: InvokeFn = defaultInvoke, listenFn: ListenFn = defaultListen) {
    this.invokeFn = invokeFn
    this.listenFn = listenFn
  }

  async open(cwd: string, cols: number, rows: number): Promise<TerminalSessionInfo> {
    return (await this.invokeFn('terminal_open', { cwd, cols, rows })) as TerminalSessionInfo
  }

  async write(id: string, data: string): Promise<void> {
    await this.invokeFn('terminal_write', { id, data })
  }

  async resize(id: string, cols: number, rows: number): Promise<void> {
    await this.invokeFn('terminal_resize', { id, cols, rows })
  }

  async close(id: string): Promise<void> {
    await this.invokeFn('terminal_close', { id })
  }

  onData(cb: (event: TerminalDataEvent) => void): Promise<() => void> {
    return this.listenFn<TerminalDataEvent>('terminal:data', (event) => cb(event.payload))
  }

  onExit(cb: (event: TerminalExitEvent) => void): Promise<() => void> {
    return this.listenFn<TerminalExitEvent>('terminal:exit', (event) => cb(event.payload))
  }
}

export const terminalService = new TauriTerminal()
