# GitKraken vs Git Light — General Comparison

Date: 2026-10-09 (comparison completed; implementation status updated afterwards). GitKraken 12.6.0 (`com.axosoft.gitkraken`, `/Applications/GitKraken.app`, 633M). Git Light 0.1.7 (`/Users/felipe.tuyama/git-light`).

Scope: Core Git UI + Power & productivity, hosting/collaboration noted briefly. Static evidence only; no runtime launch (passive-only constraint; GitKraken was not running).

In scope (closed list — all implemented): command palette, LFS UI, bisect UI, squash UI, GPG/SSH sign flag, force-push wording + destructive confirm copy. Everything else is explicitly out of scope and will not be built — including Clone/Init/open-assist, profiles, saved workspaces, patch UI, submodules UI, GitFlow, Launchpad/Focus View, AI, integrations/PR/CI, autofetch, key management UI, `.gitattributes` viewer, palette extension to files/blame/tags, keymap centralization, stash templates, auto-prune toggle, annotated-tag dialog, WIP graph nodes, commit-message lint, and undo-scope expansion. Parity rows below mean "already shipped, keep as-is", never "build more".

## Method + Evidence

REA session (all `shipped-artifact` / `observed`, prior turn):

- `rea_open_binary /Applications/GitKraken.app` → `Contents/MacOS/GitKraken`, `mach-o arm64`, sha256 `7067907c…a09693`.
- `inspect_artifact record-and-continue` → `ev_d7792660c3b7a68b49c0af8e50a9b4ceb0e44a79d96bb43dcdd5234dee3f18a7` (transport-oversize, exported 263MB; temp bundle since wiped — see Limitations).
- Underlying `inventory_artifact ev_40b58760dca61a0430a03f7f925bec68db87c21c1e4ea2ebd89db68f026393bc`: 35,382 nodes, 53,943 occurrences, graph sha `a0f683a1…`, root sha `2bc90d7e…`.
- `rea_analyze_javascript_application /.../app.asar` FAILED `artifact_integrity_mismatch` (`8c9b665f…` vs `c06dcb56…` for unpacked `git/bin/git`). Expected — ships full git + `app.asar.unpacked`. Fell back to `@electron/asar` list/extract. No JS execution.

Re-verified this turn (repeatable, no REA MCP needed):

- `asar.listPackage` → 52,971 entries. Entry points: `src/main/static/main.bundle.js` (+ 16 numbered `*.main.bundle.js` chunks), `src/render/static/entryPoints/main/render.bundle.js`, `src/render/static/entryPoints/requestHandler/requestHandler.bundle.js`.
- `package.json` → `gitkraken 12.6.0`, `main ./src/main/static/main.bundle.js`, 140 deps.
- `src/strings.json` → 5,438 keys. Top prefixes: `Cli` 777, `ContextMenu` 175, `FocusView` 153, `Ai` 93 + `AI` 56 + `GKAIPreferences` 59 + `AgentWorkflow` 65, `Workspace` 80 + `AddEditWorkspace` 53, `PullRequest*` ~174, `IssueTracker*` ~200, `Lfs` 43, `Submodule` 58, `GitFlow` 45, `Patch` 42, `Profile` 39, `GPGPreferences` 35, `FuzzyFinder` 68, `RepoManagement` 50.
- `src/keyBindings/{darwin,linux,shared}.json` exist; `darwin.json` is a 99-byte shim (`command-up/down → shared:commandUp/Down`); real map in `shared.json` (e.g. `command-shift-o → view:toggleFuzzyFinder`, `command-f → view:focusModalSearchOrOpenCommitSearch`).
- Images: `agent-logos/{claude,cursor,github-copilot,google-gemini,openai,opencode}.svg`, `conflict-detection/*`, `workspace-slide-01..06.png`, `onboarding/gkftux-*.svg`, hosting logos (`github, gitlab-color, bitbucket-color, azuredevops-color, microsoft-logo`).
- Modules: `@gitkraken/provider-apis`, `@gitkraken/shared-web-components/.../focus-view/*`, `@axosoft/azure-devops-node-api`, `@octokit/rest`, `@gitbeaker/node`, `bitbucket-v2`, `nodegit-flow`, `fuzzy` + `fuzzaldrin-plus` + `minisearch`, `node-pty` + `xterm`, `nsfw`, `diff`/`diff3`, `prismjs`, `yargs`/`commander`, `gkcli/gk`, `resources/cli/{unix,win}/gkc*`.
- `Info.plist` → 12.6.0. Bundled `git/` tree incl. `git-bisect`; `scalar` binary present.

Git Light source (verified): `README.md`, `ARCHITECTURE.md`, `OUT_OF_SCOPE.md`, `shared/git/actions.ts`, `shared/git/undoPolicy.ts`, `electron/git/ActionRouter(.test).ts`, `shared/git/rebase.ts`, `src/stores/ui.ts`, `src/features/*`.

Limitations: strings/file-names/deps prove presence, not runtime behavior. Bundles not decompiled. No window observation. Prior 263MB evidence bundle wiped from temp; counts above re-derived repeatably. REA MCP tools unavailable in this session turn, so no new `trace_*`/`observe_*`; residual U1–U4 remain static-only by design.

## How GitKraken works (observed)

- Electron shell: main bundle + numbered chunks + render bundle + requestHandler entry. React + Redux + redux-saga + reselect + jotai; `@gitkraken/*` + `@axosoft/gk-ui-kit`, `react-virtualized`, `dnd-kit`/`react-dnd`.
- Git engine dual: full bundled `git/` (`git/bin/git`, `git-core/git-*`) + `nodegit` + `nodegit-flow` + `rust-socket-bridge` + `node-spawn-server`. CLI: `gkcli/gk`, `resources/cli` (`gkc`, `gkcrc`, shell rc files).
- Onboarding: `RepoManagement*` 50 keys, `OnboardingGetReadyPanel-*` (“Reduce errors - no Git commands needed”, “Speed up your workflows with GitKraken AI”), `find-git-repositories` dep, onboarding SVGs.
- Triage model: `FocusView-Title = Launchpad`; `FocusView-ActionsWip*`, `WipBadge`, `IssueBadge`, `NoBuildStatusAvailable`; `focus-view/` web component. WIP/Issue-centric, not just graph-centric.
- Workspaces: `Workspace*` + `AddEditWorkspace*`, local vs cloud workspaces, team/org sharing, machine limits, Azure project-sync/direct modes, 6 `workspace-slide` images.
- AI: `AI-Template-*` (~50: 50-char, conventional-commits, imperative-mood, conflict both-sides/strategy, PR breaking-changes/reviewer-guidance/testing, stash verbs/branch/task), `AgentWorkflow` 65, 6 agent logos, `GKAIPreferences` 59.
- Palette: `FuzzyFinder-DefaultPlaceHolder = "Search for commands and actions (e.g., Open Repo)"`; placeholders for checkout/blame/tags/PRs; bound to `command-shift-o`.
- Safety nets: `StashMessage-UndoRedo-DiscardAllChanges`, `StashMessage-CherryPick`, `RedoInvalidButtonTooltip`, `RefBar-SilentFetchFailed`, `GeneralPreferences-AutoPrune`, `ForcePush(ButtonLabel|WithLease)`.

## Feature matrix — Core Git UI

| Capability | GitKraken 12.6.0 evidence | Git Light 0.1.7 | Gap |
|---|---|---|---|
| Commit graph, lanes, pagination, compare | `render.bundle.js`, virtualized deps, `FocusView*` | ✅ lanes/refs/pagination/shift-compare/keyboard nav (`src/lib/graph/computeGraphLayout.ts`) | Parity. WIP/worktree graph nodes stay out |
| Branch sidebar, favs, tags, drag-drop merge/rebase | `ContextMenu-RebaseBranchOntoBranchInteractively`, `BranchConstants.js`, dnd deps | ✅ favorites/tags/stashes/worktrees + drag-drop | Parity core. GK's 175 `ContextMenu*` stay out |
| Working tree stage/unstage, hunk/patch | `DiscardThisHunk`, `RevertThisHunk`, `diff`/`diff3` | ✅ flat/tree, hunk stage/unstage, commit (sign-off, GPG/SSH `-S`) | Parity. Patch apply-to-branch / stash-then-apply stays out |
| Diff viewer, blame, file history | `File-Blame`, `FileHistory-BlameButtonLabel`, `prismjs` | ✅ unified/split, highlight, blame overlay + history | Parity |
| Fetch/pull/push/sync, prune, tags | `ForcePush*`, `PullOptions-FetchAll`, `GeneralPreferences-AutoPrune` | ✅ fetch/pull/push/sync, fetch-all, prune, push-tags | Parity (manual/event-driven). Autofetch stays out |
| Merge/rebase/interactive-rebase/cherry-pick | `AbortRebaseButtonLabel`, `UnsupportedRebaseMessageGitExecutable`, `StashMessage-CherryPick` | ✅ continue/abort banner | Parity core |
| Squash | `ContextMenu-SquashCommit`, `CommitAndSquashMergeButtonLabel`; engine `merge --squash` | ✅ toolbar Merge ▸ Squash merge, commit-row Merge into Current ▸ Squash merge (`meta: { squash: true }`), squash-aware success message (`Squashed X — review staged changes and commit`) | Done |
| Conflicts ours/theirs/block | `images/conflict-detection/*`, `MergeConflictDetected`, 6+ `AI-Template-Conflict*` | ✅ ours/theirs/per-block | Parity local resolve. Prevention/detection UX + explain templates stay out |
| Undo/redo | `StashMessage-UndoRedo-DiscardAllChanges`, `RedoInvalidButtonTooltip` | ✅ reflog-backed (`ReflogJournal.ts` + `undoPolicy.ts` journalable map) | Parity. `discard-*`/`drop-stash` non-journalable by design (per-kind confirm copy in `describeAction`); undo expansion stays out |
| Stash | `Stash*`, `Folder-CherryPickFromStash` | ✅ stash/pop/apply/drop/rename | Parity ops. WIP UX + message templates stay out |
| Search | Global fuzzy finder (commands/branches/files/blame/tags) | ✅ commit + file search + palette for commands/branches | Files/blame/tags search stays out |
| Amend, tags, worktrees | `AmendPreviousCommitMessageTip`, `AnnotatedTag`, `ShowWorktreeWipNodes` | ✅ amend, tag CRUD/checkout, worktree add/remove | Parity |
| Commit signing (GPG/SSH) | `GPGPreferences*` 35 keys, `CopyPublicKey`, expiry help | ✅ `Sign commit (GPG/SSH)` checkbox (`repo.signCommit`, per-tab cache + reset) → `-S` on `commit`/`amend` (+ tests) | Done for sign flag; key management stays out |
| Force-push safety | `ForcePushWithLeaseButtonLabel` | ✅ `--force-with-lease` engine + `(with lease)` labels, busy text, and destructive-confirm copy | Done |

## Feature matrix — Power & productivity

| Capability | GitKraken evidence | Git Light | Gap |
|---|---|---|---|
| Command palette / fuzzy finder | 68 `FuzzyFinder*` keys, `fuzzy` dep, `command-shift-o` binding | ✅ `src/lib/commands.ts` + `CommandPalette.vue` (`⌘K` / `⌘⇧O`, ~20 commands + top-8 branch checkout, Toolbar button) | Done. Files/blame/tags stay out |
| Profiles (author identity) | `Profile-AddAProfile`, `AuthorEmail`, 39 keys | ❌ Gravatar read-only (`avatar.ts`); no author-profile CRUD | Out of scope |
| GitFlow | `nodegit-flow`, 45 `GitFlow*` keys | ❌ no actions | Out of scope |
| LFS UI | 43 `Lfs*` keys (track/prune/attributes) | ✅ `lfs-track` / `lfs-untrack` / `lfs-prune` via `git lfs` (friendly error when `git-lfs` missing); prune destructive-confirmed; Toolbar Workflows menu + palette + prompt helpers | Done. `.gitattributes` viewer stays out |
| Submodules full UI | 58 `Submodule*` keys, `AutoUpdateSubmodules` | ⚠️ parser awareness only (`isSubmodule`) | Out of scope |
| Patches (create/apply/share) | 42 `Patch*` keys | ⚠️ internal `buildPatch.ts` only; no user workflow | Out of scope |
| Bisect UI | ships `git-bisect`; thin UI | ✅ `bisect-start/good/bad/skip/reset` (start auto-`reset`s on mark failure) + banner buttons + Toolbar Workflows `Start Bisect…` + palette | Done, slightly ahead of GK's thin UI |
| Launchpad / Focus View | `FocusView-Title=Launchpad`, WIP/Issue badges, `focus-view/` component | ❌ no equivalent | Out of scope |
| Workspaces (saved repo groups) | 133 workspace keys, local vs cloud, team sharing | ⚠️ tabs exist (`repoTabs`, `repoTabCache`) but no saved/named groups | Out of scope, tabs stay as-is |
| AI messages/conflicts/PRs | ~150 AI keys, 6 agent logos, `AgentWorkflow` 65 | ❌ not built | Out of scope |
| Integrations (GH/GL/BB/Azure/Jira/Trello) | provider-apis, octokit, gitbeaker, bitbucket-v2, azure-devops-node-api, hosting logos | ⚠️ `open-on-github` link only | Out of scope |
| Terminal | 777 `Cli*` keys, `gkc` shell integration, node-pty + xterm | ✅ xterm + node-pty panel | Parity for panel; shell-rc layer stays out |
| Themes | `UIPreferences` 34 | ✅ 5 themes + system | Parity |
| Clone/init/open-assist | `RepoManagement*` 50, onboarding art, `find-git-repositories` | ❌ open-folder only; no `clone`/`init` path | Out of scope |
| Auto-update | Squirrel/electron strings | ✅ packaged check + menu | Parity |

Hosting/collab: GK PR/Issue/CI/orgs/teams/cloud-patches are a separate product layer, out of scope per `OUT_OF_SCOPE.md:20-32`.

## Implementation status

All six in-scope items are implemented and marked Done in the matrices above: command palette, LFS (track/untrack/prune), bisect (start/good/bad/skip/reset), squash UI, GPG/SSH sign flag, force-push wording + destructive confirm copy. Verified: `typecheck` clean, 272/272 tests, `npm run build` OK.

## Open items

1. `OUT_OF_SCOPE.md` still stale on two rows: “Multi-repo tabs: one repo per window” vs shipped `repoTabs`/`repoTabCache`; “no terminal replacement” vs shipped terminal. Fix those lines so reviews stop re-litigating scope.
2. `sandbox: false` (`ARCHITECTURE.md`). Everything landed on `git` CLI + prompts (no new sandbox surface), but audit preload + retest git IPC + electron-store before any workspace-scale file-ops. GK ships hardened/signed.

No further build planned — the in-scope list is closed.

## Residual unknowns (bounded)

- U1: Bundle runtime behavior (graph virtualization, Launchpad rules, workspace sync) — strings/deps only; bundles not decompiled, no execution.
- U2: Native call shapes (NodeGit vs CLI fallback) — no live tracing by design.
- U3: Update-channel specifics vs `updateCheck.ts` — not compared.
- U4: `nodegit-flow`/`fuzzy`/`nsfw` active-vs-legacy in 12.6.0 — import graph not traced (no REA MCP this turn).

## Repro (repeatable without REA MCP)

```bash
plutil -p "/Applications/GitKraken.app/Contents/Info.plist" | grep -E "CFBundleShortVersionString|CFBundleIdentifier"
node -e "const a=require('/Users/felipe.tuyama/git-light/node_modules/@electron/asar');console.log(a.listPackage('/Applications/GitKraken.app/Contents/Resources/app.asar').length)"
node -e "const a=require('/Users/felipe.tuyama/git-light/node_modules/@electron/asar'),fs=require('fs');for(const p of ['package.json','src/strings.json','src/keyBindings/shared.json']){fs.writeFileSync('/tmp/gk-'+p.replace(/\//g,'_'),a.extractFile('/Applications/GitKraken.app/Contents/Resources/app.asar',p))}"
python3 -c "import json;print(len(json.load(open('/tmp/gk-src_strings.json'))['strings']))"
rg -n "squash|force-with-lease|commandPaletteOpen|clone" shared/git electron/git src/stores/ui.ts src/features/startup
```
