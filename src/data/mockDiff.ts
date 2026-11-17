import type { DiffHunk, DiffLine, DiffResult } from '@shared/git/models'
import type { FileStatus } from '@/types/git'

/**
 * Deterministic diff content for the mock backend. Without it the diff panel
 * is always empty when the app runs on generated data, which makes the mock
 * useless for screenshots and manual UI checks.
 */

type DraftLine = { type: DiffLine['type']; content: string }

const TS_CONTEXT: DraftLine[][] = [
  [
    { type: 'context', content: "import { createHmac } from 'node:crypto'" },
    { type: 'context', content: "import { request } from '../lib/http'" },
    { type: 'del', content: "const MAX_ATTEMPTS = 2" },
    { type: 'add', content: "const MAX_ATTEMPTS = 4" },
    { type: 'add', content: 'const TIMEOUT_MS = 15_000' },
    { type: 'context', content: '' },
    { type: 'context', content: 'export async function authorizePayment(' },
    { type: 'context', content: '  intent: PaymentIntent,' },
    { type: 'context', content: '): Promise<PaymentReceipt> {' },
  ],
  [
    { type: 'context', content: '  const response = await request(' },
    { type: 'del', content: "    '/v1/payments/authorize'," },
    { type: 'del', content: '    intent,' },
    { type: 'add', content: "    '/v1/payments/authorize'," },
    { type: 'add', content: '    {' },
    { type: 'add', content: '      body: intent,' },
    { type: 'add', content: '      timeout: TIMEOUT_MS,' },
    { type: 'add', content: '      attempts: MAX_ATTEMPTS,' },
    { type: 'add', content: '    },' },
    { type: 'context', content: '  )' },
    { type: 'context', content: '' },
    { type: 'context', content: '  if (!response.ok) {' },
    { type: 'del', content: "    throw new Error('payment failed')" },
    { type: 'add', content: "    logger.error('authorize failed', { status: response.status })" },
    { type: 'add', content: '    throw new PaymentError(response.status, response.message)' },
    { type: 'context', content: '  }' },
  ],
  [
    { type: 'context', content: '  return response.data' },
    { type: 'context', content: '}' },
    { type: 'add', content: '' },
    { type: 'add', content: 'export function refundPayment(id: string, amount: number) {' },
    { type: 'add', content: '  return request(' },
    { type: 'add', content: '    `/v1/payments/${id}/refund`,' },
    { type: 'add', content: "    { method: 'POST', body: { amount } }," },
    { type: 'add', content: '  )' },
    { type: 'add', content: '}' },
  ],
]

const VUE_CONTEXT: DraftLine[][] = [
  [
    { type: 'context', content: '<script setup lang="ts">' },
    { type: 'del', content: "import { ref } from 'vue'" },
    { type: 'add', content: "import { computed, ref } from 'vue'" },
    { type: 'add', content: "import { usePaymentStore } from '@/stores/payment'" },
    { type: 'context', content: '' },
    { type: 'del', content: 'const total = ref(0)' },
    { type: 'add', content: 'const store = usePaymentStore()' },
    { type: 'add', content: 'const total = computed(() => store.cartTotal)' },
    { type: 'context', content: '</script>' },
  ],
  [
    { type: 'context', content: '<template>' },
    { type: 'del', content: '  <div class="summary">' },
    { type: 'add', content: '  <section class="summary" aria-label="Order summary">' },
    { type: 'context', content: '    <span>{{ total }}</span>' },
    { type: 'del', content: '  </div>' },
    { type: 'add', content: '  </section>' },
    { type: 'context', content: '</template>' },
  ],
]

const CSS_CONTEXT: DraftLine[][] = [
  [
    { type: 'context', content: ':root {' },
    { type: 'del', content: '  --accent: #5b8cff;' },
    { type: 'add', content: '  --accent: #4f7cff;' },
    { type: 'add', content: '  --accent-soft: color-mix(in srgb, var(--accent) 18%, transparent);' },
    { type: 'context', content: '  --surface: #14161c;' },
    { type: 'context', content: '}' },
  ],
  [
    { type: 'context', content: '.card {' },
    { type: 'del', content: '  padding: 12px;' },
    { type: 'add', content: '  padding: 14px 16px;' },
    { type: 'add', content: '  border: 1px solid var(--border-strong);' },
    { type: 'context', content: '  border-radius: 8px;' },
    { type: 'context', content: '}' },
  ],
]

const MD_CONTEXT: DraftLine[][] = [
  [
    { type: 'context', content: '# Payment flow' },
    { type: 'context', content: '' },
    { type: 'del', content: 'The checkout posts the card details to the API.' },
    { type: 'add', content: 'The checkout posts a payment intent to the API.' },
    { type: 'add', content: '' },
    { type: 'add', content: 'Retries use exponential backoff and stop after four attempts.' },
  ],
]

function contextForPath(path: string): DraftLine[][] {
  if (path.endsWith('.vue')) return VUE_CONTEXT
  if (path.endsWith('.css')) return CSS_CONTEXT
  if (path.endsWith('.md')) return MD_CONTEXT
  return TS_CONTEXT
}

function languageForPath(path: string): string {
  const ext = path.split('.').pop() ?? ''
  const languages: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    vue: 'vue',
    css: 'css',
    md: 'markdown',
    json: 'json',
    svg: 'xml',
    yml: 'yaml',
    yaml: 'yaml',
  }
  return languages[ext] ?? 'plaintext'
}

function toHunk(draft: DraftLine[], index: number, status: FileStatus): DiffHunk {
  let oldLine = 1 + index * 20
  let newLine = 1 + index * 20
  const lines: DiffLine[] = draft.map((line) => {
    const type = status === 'added' ? 'add' : status === 'deleted' ? 'del' : line.type
    const result: DiffLine = {
      type,
      content: line.content,
      oldLine: type === 'add' ? null : oldLine,
      newLine: type === 'del' ? null : newLine,
    }
    if (type !== 'add') oldLine += 1
    if (type !== 'del') newLine += 1
    return result
  })

  const oldLines = lines.filter((line) => line.oldLine !== null).length
  const newLines = lines.filter((line) => line.newLine !== null).length
  return {
    header: `@@ -${oldLines === 0 ? 0 : 1 + index * 20},${oldLines} +${newLines === 0 ? 0 : 1 + index * 20},${newLines} @@`,
    oldStart: oldLines === 0 ? 0 : 1 + index * 20,
    oldLines,
    newStart: newLines === 0 ? 0 : 1 + index * 20,
    newLines,
    lines,
  }
}

export function mockDiff(path: string, status: FileStatus = 'modified'): DiffResult {
  const hunks = contextForPath(path).map((draft, index) => toHunk(draft, index, status))
  const lines = hunks.flatMap((hunk) => hunk.lines)
  return {
    path,
    binary: false,
    tooLarge: false,
    language: languageForPath(path),
    hunks,
    additions: lines.filter((line) => line.type === 'add').length,
    deletions: lines.filter((line) => line.type === 'del').length,
  }
}
