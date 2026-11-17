<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink, Terminal as TerminalIcon, Trash2, X } from '@lucide/vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '@/stores/terminal'
import { useRepositoryStore } from '@/stores/repository'
import { useUiStore } from '@/stores/ui'
import { terminalService } from '@/lib/tauri/terminal'
import { isTauri } from '@/lib/backend'

const { t } = useI18n()
const terminalStore = useTerminalStore()
const repo = useRepositoryStore()
const ui = useUiStore()

const host = ref<HTMLDivElement>()
const error = ref<string | null>(null)
const shellName = ref<string | null>(null)
const starting = ref(false)

const repoPath = computed(() => repo.repository?.path ?? null)

let term: Terminal | undefined
let fitAddon: FitAddon | undefined
let sessionId: string | null = null
let sessionToken = 0
const disposers: Array<() => void> = []
let resizeObserver: ResizeObserver | undefined
let fitFrame = 0

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** Keep xterm's canvas in sync with the app theme variables. */
function applyTheme(): void {
  if (!term) return
  const accent = cssVar('--color-accent', '#6e9fff')
  term.options.theme = {
    background: cssVar('--color-app', '#12151a'),
    foreground: cssVar('--color-fg', '#e6edf3'),
    cursor: accent,
    cursorAccent: cssVar('--color-app', '#12151a'),
    selectionBackground: cssVar('--color-accent-soft', 'rgba(110, 159, 255, 0.24)'),
    black: '#484f58',
    red: cssVar('--color-danger', '#f85149'),
    green: cssVar('--color-success', '#3fb950'),
    yellow: cssVar('--color-warning', '#f0883e'),
    blue: accent,
    magenta: '#db61a2',
    cyan: '#39c5cf',
    white: cssVar('--color-fg', '#e6edf3'),
    brightBlack: cssVar('--color-fg-subtle', '#6b7280'),
    brightRed: '#ff7b72',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#f778ba',
    brightCyan: '#56d4dd',
    brightWhite: '#ffffff',
  }
}

function decodeBase64(data: string): Uint8Array {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function ensureTerminal(): Terminal {
  if (term) return term
  term = new Terminal({
    cursorBlink: true,
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: 12,
    lineHeight: 1.2,
    scrollback: 5000,
    allowTransparency: true,
    macOptionIsMeta: true,
  })
  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.onData((data) => {
    const id = sessionId
    if (id) void terminalService.write(id, data).catch(() => {})
  })
  term.onResize(({ cols, rows }) => {
    const id = sessionId
    if (id) void terminalService.resize(id, cols, rows).catch(() => {})
  })
  return term
}

function fit(): void {
  if (!fitAddon || !host.value || !term) return
  if (host.value.clientWidth === 0 || host.value.clientHeight === 0) return
  const before = { cols: term.cols, rows: term.rows }
  fitAddon.fit()
  // `fit()` fires onResize only when the grid actually changed; push the
  // initial size once anyway so the PTY matches the first paint.
  if (before.cols !== term.cols || before.rows !== term.rows) {
    const id = sessionId
    if (id) void terminalService.resize(id, term.cols, term.rows).catch(() => {})
  }
}

function scheduleFit(): void {
  cancelAnimationFrame(fitFrame)
  fitFrame = requestAnimationFrame(() => fit())
}

async function stopSession(): Promise<void> {
  const id = sessionId
  sessionId = null
  sessionToken += 1
  if (id) await terminalService.close(id).catch(() => {})
}

async function startSession(): Promise<void> {
  const path = repoPath.value
  if (!path) return
  error.value = null
  if (!isTauri()) {
    error.value = t('shell.terminal.desktopOnly')
    return
  }
  await stopSession()
  const token = sessionToken
  const view = ensureTerminal()
  view.reset()
  applyTheme()
  starting.value = true
  try {
    applyTheme()
    fit()
    const info = await terminalService.open(path, Math.max(view.cols, 20), Math.max(view.rows, 5))
    if (token !== sessionToken) {
      await terminalService.close(info.id).catch(() => {})
      return
    }
    sessionId = info.id
    shellName.value = info.shell
    await nextTick()
    fit()
    // Initial size for the PTY, even when the fit grid matches the fallback.
    void terminalService.resize(
      info.id,
      Math.max(view.cols, 20),
      Math.max(view.rows, 5),
    ).catch(() => {})
    view.focus()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    starting.value = false
  }
}

function clearScreen(): void {
  term?.clear()
  term?.focus()
}

async function openExternal(): Promise<void> {
  if (!repoPath.value) return
  try {
    await repo.runAction({ kind: 'open-terminal' })
  } catch {
    /* handled by the repository store toast */
  }
}

function closePanel(): void {
  terminalStore.setOpen(false)
}

onMounted(async () => {
  const view = ensureTerminal()
  view.open(host.value!)
  applyTheme()
  if (!isTauri()) {
    error.value = t('shell.terminal.desktopOnly')
    return
  }
  await terminalService
    .onData((event) => {
      if (event.id !== sessionId) return
      term?.write(decodeBase64(event.data))
    })
    .then((unlisten) => disposers.push(unlisten))
    .catch(() => {})
  await terminalService
    .onExit((event) => {
      if (event.id !== sessionId) return
      sessionId = null
      term?.write(`\r\n\x1b[38;5;244m${t('shell.terminal.exited')}\x1b[0m\r\n`)
    })
    .then((unlisten) => disposers.push(unlisten))
    .catch(() => {})

  resizeObserver = new ResizeObserver(scheduleFit)
  if (host.value) resizeObserver.observe(host.value)
  await nextTick()
  fit()
  await startSession()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(fitFrame)
  resizeObserver?.disconnect()
  resizeObserver = undefined
  for (const dispose of disposers.splice(0)) dispose()
  void stopSession()
  term?.dispose()
  term = undefined
  fitAddon = undefined
})

watch(repoPath, (path) => {
  if (!terminalStore.open) return
  if (path) {
    void startSession()
  } else {
    void stopSession()
    term?.reset()
    shellName.value = null
  }
})

watch(
  () => ui.theme,
  () => applyTheme(),
)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col border-t border-[var(--color-border)] bg-[var(--color-app)]">
    <div class="flex h-8 shrink-0 items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-panel)] px-2">
      <div class="flex h-full items-center gap-1.5 border-b-2 border-[var(--color-accent)] px-2 text-[11px] text-[var(--color-fg)]">
        <TerminalIcon :size="12" class="text-[var(--color-fg-subtle)]" />
        <span class="font-medium">{{ shellName ?? $t('shell.terminal.title') }}</span>
        <span v-if="repo.repository" class="max-w-40 truncate text-[var(--color-fg-subtle)]" :title="repoPath ?? ''">
          {{ repo.repository.name }}
        </span>
        <span v-if="starting" class="text-[10px] text-[var(--color-fg-subtle)]">{{ $t('shell.terminal.starting') }}</span>
      </div>
      <div class="flex-1" />
      <button
        class="app-no-drag focus-ring rounded p-1 text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
        :title="$t('shell.terminal.clear')"
        :aria-label="$t('shell.terminal.clear')"
        @click="clearScreen"
      >
        <Trash2 :size="12" />
      </button>
      <button
        class="app-no-drag focus-ring rounded p-1 text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
        :title="$t('shell.terminal.openExternal')"
        :aria-label="$t('shell.terminal.openExternal')"
        @click="openExternal"
      >
        <ExternalLink :size="12" />
      </button>
      <button
        class="app-no-drag focus-ring rounded p-1 text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
        :title="$t('shell.terminal.close')"
        :aria-label="$t('shell.terminal.close')"
        @click="closePanel"
      >
        <X :size="13" />
      </button>
    </div>
    <div class="relative min-h-0 flex-1">
      <div ref="host" class="h-full w-full px-2 py-1" />
      <div
        v-if="error"
        class="absolute inset-0 flex items-center justify-center bg-[var(--color-app)] px-4 text-center text-[12px] text-[var(--color-fg-subtle)]"
      >
        {{ error }}
      </div>
    </div>
  </div>
</template>
