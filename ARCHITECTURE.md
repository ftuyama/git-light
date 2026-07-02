# Architecture

Git Light is an Electron desktop app with a Vue 3 renderer. The UI depends on a `GitService` interface; the renderer never talks to Git directly.

## Stack

| Layer | Technology |
|-------|------------|
| Shell | Electron 41 |
| UI | Vue 3, Pinia, Tailwind v4, reka-ui |
| Build | electron-vite, TypeScript |
| Git | Native `git` CLI in main process |
| Terminal | xterm.js + node-pty (in-app panel) |
| File watch | chokidar (debounced 150ms) |

## Process model

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer (Vue)                                              │
│  features/ → stores/repository + repoDiff → lib/git/IpcGitService       │
└───────────────────────────┬─────────────────────────────────┘
                            │ contextBridge (typed IPC)
┌───────────────────────────▼─────────────────────────────────┐
│  Main process                                                │
│  registerIpc → GitProvider → GitCliProvider + parsers          │
│              → RepositoryWatcher (chokidar)                    │
│              → ActionRouter (GitAction → git argv)           │
│              → ReflogJournal (undo/redo stack)               │
└─────────────────────────────────────────────────────────────┘
```

## Shared contracts

### App shell (`shared/app/`)

| Module | Purpose |
|--------|---------|
| `metadata.ts` | App name, version, homepage, repository URL (from `package.json`) |
| `credits.ts` | App links, third-party attribution list, `formatAboutCredits()` for native About panel |
| `ipc.ts` | Non-git IPC channels (electron-store, open external, window focus/blur, terminal PTY) |

### Git layer (`shared/git/`)

| Module | Purpose |
|--------|---------|
| `ipc.ts` | Channel names + `IpcContract` request/response tuples |
| `models.ts` | Wire types (ISO date strings, serializable snapshots) |
| `actions.ts` | `GitActionKind` + `GitAction` — single source of truth |
| `errors.ts` | `GitError`, `classifyGitError()`, serialized error payloads |
| `refLabel.ts` | Branch/tag/ref display labels shared by renderer and parsers |
| `avatar.ts` | Gravatar URL helpers for commit authors |
| `rebase.ts` | Interactive rebase entry types and sequence helpers |
| `undoPolicy.ts` | Reflog-based undo/redo eligibility rules |
| `destructive.ts` | Shared destructive-action set for UI + ActionRouter |
| `snapshotScopes.ts` | Snapshot refresh scopes per `GitActionKind` |
| `credentialHints.ts` | Recovery hints for authentication/network errors |
| `githubUrl.ts` | Parse remotes and build GitHub browse URLs |

### Diff helpers (`shared/diff/`)

| Module | Purpose |
|--------|---------|
| `buildPatch.ts` | Builds unified patches for per-hunk stage/unstage |
| `guessLanguage.ts` | File-path → highlight.js language id for syntax highlighting |

`shared/perf.ts` provides lightweight timing helpers for dev profiling.

## Renderer git layer (`src/lib/git/`)

| File | Role |
|------|------|
| `GitService.ts` | Interface the store depends on |
| `IpcGitService.ts` | Production implementation via `window.electron.git` |
| `MockGitService.ts` | Generated data; used when `VITE_USE_MOCK=true` or outside Electron |
| `wireAdapter.ts` | Revives wire snapshots into domain types (`Date`, etc.) |
| `themes.ts` / `applyTheme.ts` | Theme catalog, system preference resolution, CSS variable application |
| `avatarCache.ts` | Cached author avatar images for commit rows |

## Main process (`electron/`)

| File | Role |
|------|------|
| `main.ts` | Window lifecycle, About panel options, app menu, theme-aware window background, startup update check (packaged builds) |
| `menu.ts` | Application menu (About, Check for Updates, Help links) |
| `updateCheck.ts` | Compares semver against GitHub Releases; opens DMG directly, shows release notes, supports per-version “Remind Me Later” snooze |
| `preload.ts` | Exposes typed `window.electron` bridge |
| `terminal/registerTerminalIpc.ts` | node-pty sessions; create/write/resize/kill + data/exit push events |

### Git layer (`electron/git/`)

| File | Role |
|------|------|
| `GitCliProvider.ts` | Spawns `git` with argument arrays only |
| `GitProvider.ts` | Open/validate repo, snapshot, pagination, execute, diff, search |
| `ActionRouter.ts` | Maps each `GitActionKind` to git commands |
| `ReflogJournal.ts` | Tracks reflog entries for undo/redo |
| `rebaseSequenceEditor.ts` | Writes interactive rebase todo lists |
| `RepoCache.ts` | TTL cache for status/branches |
| `RepositoryWatcher.ts` | Debounced filesystem events → `git:changed` |
| `parsers/` | Parse porcelain log, status, branches, diffs, conflicts, blame, file history, rebase commits, etc. |

## Renderer stores (`src/stores/`)

| Store | Role |
|-------|------|
| `repository` | Repo lifecycle, commits, branches, git actions, commit box |
| `repoDiff` | Selected file, diff/conflict loading, commit/compare file lists |
| `selection` | Selected/hovered commit, shift-compare range |
| `branchDrag` | Branch drag-and-drop state and integrate dialog payload |
| `ui` | Layout prefs, graph columns, sidebar sections, theme, terminal panel |
| `interactiveRebase` | Interactive rebase dialog state |
| `prompt` / `toast` | Modal and toast UI |
| `repoTabs` | Open repository tabs, active tab, persistence |
| `repoTabCache` | Per-tab snapshot cache for fast tab switching |

The `repository` store composes actions from `src/stores/repo/`:

| Module | Role |
|--------|------|
| `lifecycle.ts` | Open/close repo, refresh, pagination |
| `gitActions.ts` | Fetch, merge, rebase, stash, undo, etc. |
| `commitBox.ts` | Commit message, amend, sign-off |
| `getters.ts` | Derived repo state (HEAD, ahead/behind, etc.) |
| `graphLayout.ts` | Runs `computeGraphLayout` on commit list |
| `refreshScheduler.ts` | Debounced snapshot refresh after `git:changed` |
| `diffReloadScheduler.ts` | Debounced diff reload when selection changes |
| `actionHelpers.ts` | Shared action dispatch + error handling |

## UI layout

```
App.vue
├── StartupView          (no repo open)
└── main view
    ├── RepoTabs         multi-repo tab bar + repo switcher
    ├── Toolbar          remote/history actions, terminal toggle
    ├── OperationBanner  merge/rebase/cherry-pick/revert in progress
    ├── SidebarRail      expand affordance when left/right pane collapsed
    ├── Splitpanes
    │   ├── BranchSidebar       (drag-drop integrate dialog)
    │   ├── CommitGraph         (virtualized graph + diff/conflict overlay)
    │   │   └── optional TerminalPanel (resizable bottom split, xterm)
    │   └── WorkingTreePanel
    ├── StatusBar        ahead/behind, progress, cancel
    ├── PromptHost       confirm / prompt dialogs
    ├── SearchOverlay    commit + file search
    ├── InteractiveRebaseDialog
    ├── BlameOverlay     blame view + file history side panel
    └── AppSettingsDialog  appearance (theme, UI mode), layout, graph, sidebar, credits
```

## Data flow

1. User opens repo → `git:open-repo` → `GitProvider.open()` → full snapshot over IPC.
2. `wireAdapter` revives dates; store runs `computeGraphLayout` on commits.
3. Mutations dispatch `GitAction` → `ActionRouter` → git CLI → cache invalidation → `git:changed` → scoped `refreshSnapshot`.
4. External edits trigger chokidar → same refresh path.
5. Undo/redo reads `ReflogJournal` and dispatches reset/checkout actions per `undoPolicy`.

## Persistence

| Key | Storage |
|-----|---------|
| `git-light:preferences` | Panel sizes, collapsed state, theme, graph/sidebar/terminal prefs, open repo tabs (electron-store via preload; localStorage fallback in browser) |
| `recent-repos` | Recent repository list (electron-store, main) |
| `branch-favorites:{path}` | Per-repo pinned branches |

## Testing

- `shared/git/avatar.test.ts` — Gravatar URL helpers
- `shared/app/credits.test.ts` — About panel credits text and link lists
- `electron/updateCheck.test.ts` — semver comparison for update checks
- `electron/git/ActionRouter.test.ts` — action → git argv routing
- `electron/git/ReflogJournal.test.ts` — undo/redo journal
- `electron/git/rebaseSequenceEditor.test.ts` — interactive rebase todo writer
- `electron/git/parsers/blameParser.test.ts` — blame porcelain parser
- `electron/git/parsers/fileHistoryParser.test.ts` — file history log parser
- `electron/git/parsers/logParser.test.ts` — porcelain log parser
- `electron/git/parsers/statusParser.test.ts` — status porcelain parser
- `electron/git/parsers/commitFilesParser.test.ts` — commit file list parser
- `electron/git/parsers/conflictParser.test.ts` — merge conflict markers
- `electron/git/parsers/rebaseCommitsParser.test.ts` — rebase commit list
- `shared/git/refLabel.test.ts` — ref label formatting
- `shared/git/snapshotScopes.test.ts` — post-action snapshot refresh scopes
- `shared/git/destructive.test.ts` — destructive action classification
- `shared/git/credentialHints.test.ts` — auth/network error recovery hints
- `shared/git/githubUrl.test.ts` — GitHub URL parsing
- `shared/git/undoPolicy.test.ts` — undo/redo eligibility
- `shared/diff/buildPatch.test.ts` — patch builder for hunk staging
- `shared/diff/guessLanguage.test.ts` — syntax-highlight language detection
- `src/lib/graph/computeGraphLayout.test.ts` — graph layout algorithm
- `src/lib/graph/graphEdgePath.test.ts` — SVG edge path generation
- `src/lib/graph/pendingGraphRow.test.ts` — pending-changes graph row
- `src/lib/graph/remapHeadLaneLeft.test.ts` — head lane remapping
- `src/lib/graph/compareRange.test.ts` — shift-compare range normalization
- `src/lib/graph/commitLaneBranchPreview.test.ts` — branch lane preview on hover
- `src/lib/graph/syncBranchLaneColors.test.ts` — branch lane color sync
- `src/lib/themes.test.ts` — theme preference resolution
- `src/lib/sidebarLayout.test.ts` — sidebar collapse/expand layout
- `src/lib/avatarCache.test.ts` — author avatar image cache
- `src/features/branch-sidebar/branchRefUtils.test.ts` — branch ref name helpers
- `src/features/branch-sidebar/sortBranches.test.ts` — branch sort order
- `src/features/working-tree/buildFileTree.test.ts` — working-tree file tree
- `src/lib/diff/buildBlameBlocks.test.ts` — blame author block grouping
- `src/lib/diff/buildSplitRows.test.ts` — split diff row builder
- `src/lib/diff/estimateWrappedRowHeight.test.ts` — wrapped diff line height estimation
- `src/lib/diff/highlight.test.ts` — syntax highlighting helpers
- `src/lib/diff/pairedLineIndices.test.ts` — split diff line pairing
- `src/lib/mergeMode.test.ts` — merge mode preference helpers
- `src/lib/preferences.uiMode.test.ts` — basic/advanced UI mode visibility

Run: `npm run test`

## Extension points

- **New git operation:** add kind to `shared/git/actions.ts`, route in `ActionRouter.ts`, wire UI.
- **New snapshot field:** extend wire model + parser + `wireAdapter` + store state.
- **Replace CLI backend:** implement `GitService` without touching Vue features.

## Security notes

- Renderer uses `contextIsolation: true` and `nodeIntegration: false`; only preload exposes IPC.
- **`sandbox: false`** is intentional today: the preload script and Electron 41 + chokidar file watching were validated with sandbox disabled. Enabling sandbox would require auditing preload surface area and retesting git IPC + `electron-store`. Revisit before a hardened release build.
- Git commands use argv arrays (no shell interpolation).
- Paths passed to git are validated with `assertPathInsideRepo`.
