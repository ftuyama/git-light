import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { Terminal, type IDisposable } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

const TERMINAL_ID = 'main'

function readThemeColor(variable: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return value || fallback
}

function terminalTheme() {
  return {
    background: readThemeColor('--color-app', '#12151a'),
    foreground: readThemeColor('--color-fg', '#e6edf3'),
    cursor: readThemeColor('--color-accent', '#6e9fff'),
    selectionBackground: readThemeColor('--color-accent-soft', 'rgba(110, 159, 255, 0.16)'),
  }
}

export function useTerminal(container: Ref<HTMLElement | null>, cwd: Ref<string | null>) {
  const ready = ref(false)
  const unavailable = ref(false)
  let terminal: Terminal | null = null
  let fitAddon: FitAddon | null = null
  let offData: (() => void) | null = null
  let offExit: (() => void) | null = null
  let offInput: IDisposable | null = null
  let resizeObserver: ResizeObserver | null = null
  let activeCwd: string | null = null

  function disposePty(): void {
    offData?.()
    offData = null
    offExit?.()
    offExit = null
    void window.electron?.terminal?.kill({ id: TERMINAL_ID })
    activeCwd = null
    ready.value = false
  }

  function disposeAll(): void {
    resizeObserver?.disconnect()
    resizeObserver = null
    disposePty()
    offInput?.dispose()
    offInput = null
    terminal?.dispose()
    terminal = null
    fitAddon = null
  }

  async function fitAndResize(): Promise<void> {
    if (!terminal || !fitAddon) return
    fitAddon.fit()
    const { cols, rows } = terminal
    await window.electron?.terminal?.resize({ id: TERMINAL_ID, cols, rows })
  }

  function attachIpcListeners(): void {
    if (!window.electron?.terminal) return
    offData?.()
    offData = window.electron.terminal.onData(({ id, data }) => {
      if (id === TERMINAL_ID) terminal?.write(data)
    })
    offExit?.()
    offExit = window.electron.terminal.onExit(({ id, exitCode }) => {
      if (id !== TERMINAL_ID) return
      ready.value = false
      activeCwd = null
      terminal?.writeln(`\r\n\x1b[90mProcess exited (${exitCode}).\x1b[0m`)
    })
  }

  function mountTerminal(): void {
    const el = container.value
    if (!el || terminal) return
    terminal = new Terminal({
      cursorBlink: true,
      fontFamily: readThemeColor('--font-mono', 'ui-monospace, monospace'),
      fontSize: 12,
      lineHeight: 1.25,
      theme: terminalTheme(),
      scrollback: 5000,
    })
    fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(el)
    offInput = terminal.onData((data) => {
      void window.electron?.terminal?.write({ id: TERMINAL_ID, data })
    })
    attachIpcListeners()
    resizeObserver = new ResizeObserver(() => {
      void fitAndResize()
    })
    resizeObserver.observe(el)
  }

  async function spawnSession(path: string): Promise<void> {
    if (!terminal || !fitAddon || !window.electron?.terminal) return
    disposePty()
    fitAddon.fit()
    const { cols, rows } = terminal
    const result = await window.electron.terminal.create({ id: TERMINAL_ID, cwd: path, cols, rows })
    if (!result.ok) {
      unavailable.value = true
      terminal.writeln('\x1b[31mCould not start terminal session.\x1b[0m')
      return
    }
    unavailable.value = false
    activeCwd = path
    ready.value = true
    attachIpcListeners()
    terminal.focus()
  }

  async function ensureSession(): Promise<void> {
    const path = cwd.value
    if (!path || !window.electron?.terminal) return
    if (activeCwd === path && ready.value) return
    mountTerminal()
    await spawnSession(path)
  }

  onMounted(() => {
    if (!window.electron?.terminal) {
      unavailable.value = true
      return
    }
    void ensureSession()
  })

  watch(cwd, (path) => {
    if (!path || !window.electron?.terminal) return
    void ensureSession()
  })

  onBeforeUnmount(() => {
    disposeAll()
  })

  return {
    ready,
    unavailable,
    fit: fitAndResize,
    focus: () => terminal?.focus(),
  }
}
