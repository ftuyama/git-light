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
| `es` | Español | Also used for `es-*` (es-419, es-MX, …) at detection time. |
| `fr` | Français | Also used for `fr-*` (fr-CA, …) at detection time. |
| `de` | Deutsch | Also used for `de-*` (de-AT, de-CH, …) at detection time. |
| `ja` | 日本語 (Japanese) | No plural forms: count messages use a **single** form. |

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

| English | pt-BR | zh-CN | es | fr | de | ja |
| --- | --- | --- | --- | --- | --- | --- |
| repository | repositório | 仓库 | repositorio | dépôt | Repository | リポジトリ |
| branch | branch | 分支 | rama | branche | Branch | ブランチ |
| remote | remoto | 远程 | remoto | distant | Remote | リモート |
| remote-tracking branch | branch de rastreamento remoto | 远程跟踪分支 | rama de seguimiento remoto | branche de suivi distant | Remote-Tracking-Branch | リモート追跡ブランチ |
| tag | tag | 标签 | etiqueta | étiquette | Tag | タグ |
| commit | commit | 提交 | commit | commit | Commit | コミット |
| commit message | mensagem do commit | 提交信息 | mensaje del commit | message de commit | Commit-Nachricht | コミットメッセージ |
| author | autor | 作者 | autor | auteur | Autor | 作成者 |
| committer | autor do commit | 提交者 | autor del commit | auteur du commit | Committer | コミッター |
| stash | stash | 贮藏 | stash | remisage | Stash | スタッシュ |
| worktree | worktree | 工作树 | worktree | worktree | Worktree | ワークツリー |
| working tree | árvore de trabalho | 工作区 | árbol de trabajo | arbre de travail | Arbeitsbaum | 作業ツリー |
| staging area / index | área de staging | 暂存区 | área de preparación | zone d'index | Index | ステージングエリア |
| staged changes | alterações preparadas | 已暂存的更改 | cambios preparados | modifications indexées | gestagte Änderungen | ステージ済みの変更 |
| unstaged changes | alterações não preparadas | 未暂存的更改 | cambios sin preparar | modifications non indexées | nicht gestagte Änderungen | 未ステージの変更 |
| discard changes | descartar alterações | 丢弃更改 | descartar cambios | annuler les modifications | Änderungen verwerfen | 変更を破棄 |
| hunk | trecho | 代码块 | fragmento | bloc | Hunk | ハンク |
| diff | diff | 差异 | diferencias | différences | Diff | 差分 |
| blame | blame | 追溯 | blame | blame | Blame | blame |
| file history | histórico do arquivo | 文件历史 | historial del archivo | historique du fichier | Dateiverlauf | ファイル履歴 |
| merge | merge | 合并 | fusión | fusion | Merge | マージ |
| merge conflict | conflito de merge | 合并冲突 | conflicto de fusión | conflit de fusion | Merge-Konflikt | マージ競合 |
| resolve conflict | resolver conflito | 解决冲突 | resolver conflicto | résoudre le conflit | Konflikt lösen | 競合を解決 |
| rebase | rebase | 变基 | rebase | rebasage | Rebase | リベース |
| cherry-pick | cherry-pick | 拣选 | cherry-pick | cherry-pick | Cherry-Pick | チェリーピック |
| fast-forward | fast-forward | 快进 | avance rápido | avance rapide | Fast-Forward | ファストフォワード |
| pull | pull | 拉取 | pull | pull | Pull | プル |
| push | push | 推送 | push | push | Push | プッシュ |
| fetch | fetch | 获取 | fetch | fetch | Fetch | フェッチ |
| upstream | upstream | 上游 | upstream | upstream | Upstream | 上流 |
| detached HEAD | HEAD destacado | 分离的 HEAD | HEAD separado | HEAD détaché | Detached HEAD | デタッチド HEAD |
| checkout | checkout | 检出 | checkout | checkout | Checkout | チェックアウト |
| revert | reverter | 还原 | revertir | annuler | Revert | 打ち消し |
| reset | reset | 重置 | reset | reset | Reset | リセット |
| amend | emendar | 修补 | enmendar | amender | Amend | 修正 |
| squash | squash | 压缩 | squash | squash | Squash | スカッシュ |
| sign-off | sign-off | 署名 | sign-off | sign-off | Sign-off | サインオフ |
| commit signing | assinatura de commit | 提交签名 | firma de commits | signature des commits | Commit-Signierung | コミット署名 |
| submodule | submódulo | 子模块 | submódulo | sous-module | Submodul | サブモジュール |
| reflog | reflog | 引用日志 | reflog | reflog | Reflog | reflog |
| bare repository | repositório bare | 裸仓库 | repositorio bare | dépôt nu | Bare-Repository | ベアリポジトリ |
| ignore whitespace | ignorar espaços em branco | 忽略空白 | ignorar espacios en blanco | ignorer les espaces blancs | Leerraum ignorieren | 空白を無視 |
| word wrap | quebra de linha automática | 自动换行 | ajuste de línea | retour à la ligne automatique | Zeilenumbruch | 折り返し |
| sidebar | barra lateral | 侧边栏 | barra lateral | barre latérale | Seitenleiste | サイドバー |
| tab | aba | 标签页 | pestaña | onglet | Tab | タブ |
| toast | notificação | 通知 | notificación | notification | Benachrichtigung | 通知 |
| shortcut / keybinding | atalho | 快捷键 | atajo | raccourci | Tastenkürzel | ショートカット |
| command palette | paleta de comandos | 命令面板 | paleta de comandos | palette de commandes | Befehlspalette | コマンドパレット |
| undo / redo | desfazer / refazer | 撤销 / 重做 | deshacer / rehacer | annuler / rétablir | Rückgängig / Wiederholen | 元に戻す / やり直す |

## Migration guard

`npm run i18n:audit` counts user-visible literals still hardcoded in Vue
templates and `toast.push()` calls, and compares with
`scripts/i18n-baseline.json`. It fails when a change adds new literals; after a
migration batch, refresh the baseline with
`node scripts/i18n-audit.mjs --update`.
