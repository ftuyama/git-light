# Translation glossary & conventions

Single source of truth for everyone (human or agent) adding strings to
`src/locales/`. Read this before touching a catalog: consistent terminology
matters more than a "nicer" individual translation.

## Locales

| Code | Language | Notes |
| --- | --- | --- |
| `en` | English | Source of truth. Every other locale mirrors its key set. |
| `pt-BR` | Português (Brasil) | Also used for `pt`/`pt-PT` at detection time. |
| `zh-CN` | 简体中文 (Simplified Chinese) | `zh-TW`/`zh-Hant` are **not** covered yet. |

Adding a locale: create `src/locales/<code>/` with the same 13 domain files,
add the code to `APP_LOCALES` in `src/lib/locales.ts`, add the native label to
`LOCALE_LABELS`, and add the `date-fns` locale to `DATE_FNS_LOCALES` in
`src/lib/format.ts`. The parity test enforces the rest.

## File layout

One JSON file per feature domain; a domain file is owned by the code that
feature lives in. Keep them in sync across all locales in the same change.

`common.json` holds only cross-feature vocabulary (actions, generic labels,
state words, count plurals). Feature-specific strings belong in their domain
file, never in `common.json` as a one-off.

| File | Owner |
| --- | --- |
| `common.json` | shared actions/labels/counts |
| `shell.json` | `App.vue`, `features/layout`, `toolbar`, `status-bar`, `startup` |
| `graph.json` | `features/commit-graph`, `palette`, `search` |
| `branches.json` | `features/branch-sidebar` |
| `workingTree.json` | `features/working-tree` |
| `diff.json` | `features/diff` |
| `conflicts.json` | `features/conflicts` |
| `rebase.json` | `features/rebase` |
| `palette.json` | command palette + global search copy |
| `settings.json` | `features/settings` |
| `menu.json` | native app menu labels (`src/lib/tauri/appMenu.ts`) |
| `shortcuts.json` | `COMMAND_META` titles (`src/lib/keybindings.ts`) |
| `errors.json` | `GitErrorCode` → message (`shared/git/errors.ts`) |

## Key conventions

- `camelCase`, max 3 levels deep (`graph.toolbar.scopeAll`).
- Keys describe **meaning**, not English text: `actions.discard`, not `discardChangesButton`.
- Dot paths are the contract; the parity test compares flattened keys, so
  renaming a key is a breaking change across all three locales.
- Components use `$t('graph.toolbar.scopeAll')` (global injection) — no import.
- Code outside components (stores, menus, toasts) uses
  `translate('...')` from `@/locales`.
- Interpolation is named: `{count}`, `{name}`, `{path}` — never concatenate
  translated fragments.
- Plurals use vue-i18n pipe syntax: `{count} commit | {count} commits`.
  pt-BR also has two forms; zh-CN uses a **single** form.
- Sentence case for sentences, no trailing period for labels and buttons.
- Never put HTML in messages; build markup around the string.
- Empty values are rejected by the parity test.

## Never translate

- Product/brand names: `Git Light`, `GitHub`, `GitKraken`.
- Git commands and refs: `git stash`, `origin/main`, branch/tag/worktree names.
- Unix paths, SHAs, email addresses.
- Raw git stderr and `GitError.detail` (it is diagnostic output).

## Terminology

| English | pt-BR | zh-CN |
| --- | --- | --- |
| repository | repositório | 仓库 |
| branch | branch | 分支 |
| remote | remoto | 远程 |
| remote-tracking branch | branch de rastreamento remoto | 远程跟踪分支 |
| tag | tag | 标签 |
| commit | commit | 提交 |
| commit message | mensagem do commit | 提交信息 |
| author | autor | 作者 |
| committer | autor do commit | 提交者 |
| stash | stash | 贮藏 |
| worktree | worktree | 工作树 |
| working tree | árvore de trabalho | 工作区 |
| staging area / index | área de staging | 暂存区 |
| staged changes | alterações preparadas | 已暂存的更改 |
| unstaged changes | alterações não preparadas | 未暂存的更改 |
| discard changes | descartar alterações | 丢弃更改 |
| hunk | trecho | 代码块 |
| diff | diff | 差异 |
| blame | blame | 追溯 |
| file history | histórico do arquivo | 文件历史 |
| merge | merge | 合并 |
| merge conflict | conflito de merge | 合并冲突 |
| resolve conflict | resolver conflito | 解决冲突 |
| rebase | rebase | 变基 |
| cherry-pick | cherry-pick | 拣选 |
| fast-forward | fast-forward | 快进 |
| pull | pull | 拉取 |
| push | push | 推送 |
| fetch | fetch | 获取 |
| upstream | upstream | 上游 |
| detached HEAD | HEAD destacado | 分离的 HEAD |
| checkout | checkout | 检出 |
| revert | reverter | 还原 |
| reset | reset | 重置 |
| amend | emendar | 修补 |
| squash | squash | 压缩 |
| sign-off | sign-off | 署名 |
| commit signing | assinatura de commit | 提交签名 |
| submodule | submódulo | 子模块 |
| reflog | reflog | 引用日志 |
| bare repository | repositório bare | 裸仓库 |
| ignore whitespace | ignorar espaços em branco | 忽略空白 |
| word wrap | quebra de linha automática | 自动换行 |
| sidebar | barra lateral | 侧边栏 |
| tab | aba | 标签页 |
| toast | notificação | 通知 |
| shortcut / keybinding | atalho | 快捷键 |
| command palette | paleta de comandos | 命令面板 |
| undo / redo | desfazer / refazer | 撤销 / 重做 |

## Migration guard

`npm run i18n:audit` counts user-visible literals still hardcoded in Vue
templates and `toast.push()` calls, and compares with
`scripts/i18n-baseline.json`. It fails when a change adds new literals; after a
migration batch, refresh the baseline with
`node scripts/i18n-audit.mjs --update`.
