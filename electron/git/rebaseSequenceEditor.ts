import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import type { RebaseTodoLine } from '@shared/git/rebase'

export interface RebaseEditorBundle {
  env: Record<string, string>
  cleanup: () => void
}

/** Build git todo lines (oldest commit first). */
export function formatRebaseTodo(lines: RebaseTodoLine[]): string {
  return lines.map((line) => `${line.action} ${line.sha} ${line.subject}`).join('\n') + '\n'
}

/**
 * Prepare GIT_SEQUENCE_EDITOR / GIT_EDITOR helpers that apply a pre-built todo
 * list and optional reword messages without opening an external editor.
 */
export function createRebaseEditorBundle(lines: RebaseTodoLine[]): RebaseEditorBundle {
  const dir = join(tmpdir(), `git-light-rebase-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })

  const todoPath = join(dir, 'todo')
  writeFileSync(todoPath, formatRebaseTodo(lines), 'utf8')

  const seqEditorPath = join(dir, 'seq-editor.js')
  writeFileSync(
    seqEditorPath,
    `const fs = require('node:fs');
const source = ${JSON.stringify(todoPath)};
fs.copyFileSync(source, process.argv[1]);
`,
    'utf8',
  )

  const rewordMessages = lines
    .filter((line) => line.action === 'reword' && line.message != null)
    .map((line) => line.message as string)

  const idxPath = join(dir, 'reword-index')
  writeFileSync(idxPath, '0', 'utf8')

  const msgEditorPath = join(dir, 'msg-editor.js')
  writeFileSync(
    msgEditorPath,
    `const fs = require('node:fs');
const messages = ${JSON.stringify(rewordMessages)};
const idxPath = ${JSON.stringify(idxPath)};
let idx = Number.parseInt(fs.readFileSync(idxPath, 'utf8'), 10);
if (!Number.isFinite(idx)) idx = 0;
const message = messages[idx] ?? '';
fs.writeFileSync(process.argv[1], message.endsWith('\\n') ? message : message + '\\n');
fs.writeFileSync(idxPath, String(idx + 1));
`,
    'utf8',
  )

  return {
    env: {
      GIT_SEQUENCE_EDITOR: `node ${seqEditorPath}`,
      GIT_EDITOR: `node ${msgEditorPath}`,
    },
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        /* best effort */
      }
    },
  }
}
