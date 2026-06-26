# Architecture

Git Light is an Electron desktop app with a Vue 3 renderer. The UI depends on a `GitService` interface; the renderer never talks to Git directly.

## Stack

| Layer | Technology |
|-------|------------|
| Shell | Electron 41 |
| UI | Vue 3, Pinia, Tailwind v4, reka-ui |
| Build | electron-vite, TypeScript |
| Git | Native `git` CLI in main process |
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

## Shared contracts (`shared/git/`)

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
| `credentialHints.ts` | Recovery hints for authentication/network errors |
| `githubUrl.ts` | Parse remotes and build GitHub browse URLs |

`shared/diff/buildPatch.ts` builds unified patches for per-hunk stage/unstage.

## Renderer git layer (`src/lib/git/`)

| File | Role |
|------|------|
| `GitService.ts` | Interface the store depends on |
| `IpcGitService.ts` | Production implementation via `window.electron.git` |
| `MockGitService.ts` | Generated data; used when `VITE_USE_MOCK=true` or outside Electron |
| `wireAdapter.ts` | Revives wire snapshots into domain types (`Date`, etc.) |
| `destructive.ts` | Actions that require confirmation in the UI |
| `refLabel.test.ts` | Ref label formatting |
| `statusParser.test.ts` | Status porcelain parser (renderer) |

## Main-process git layer (`electron/git/`)

| File | Role |
|------|------|
| `GitCliProvider.ts` | Spawns `git` with argument arrays only |
| `GitProvider.ts` | Open/validate repo, snapshot, pagination, execute, diff, search |
| `ActionRouter.ts` | Maps each `GitActionKind` to git commands |
| `ReflogJournal.ts` | Tracks reflog entries for undo/redo |
| `rebaseSequenceEditor.ts` | Writes interactive rebase todo lists |
| `RepoCache.ts` | TTL cache for status/branches |
| `RepositoryWatcher.ts` | Debounced filesystem events → `git:changed` |
| `parsers/` | Parse porcelain log, status, branches, diffs, conflicts, rebase commits, etc. |

## Renderer stores (`src/stores/`)

| Store | Role |
|-------|------|
| `repository` | Repo lifecycle, commits, branches, git actions, commit box |
| `repoDiff` | Selected file, diff/conflict loading, commit/compare file lists |
| `selection` | Selected/hovered commit, shift-compare range |
| `ui` | Layout prefs, graph columns, sidebar sections |
| `interactiveRebase` | Interactive rebase dialog state |
| `prompt` / `toast` | Modal and toast UI |

Helpers live under `src/stores/repo/` (`graphLayout.ts`, `actionHelpers.ts`).

## UI layout

```
App.vue
├── StartupView          (no repo open)
└── main view
    ├── Toolbar          remote/history actions, repo switcher
    ├── OperationBanner  merge/rebase/cherry-pick/revert in progress
    ├── Splitpanes
    │   ├── BranchSidebar       (drag-drop integrate dialog)
    │   ├── CommitGraph         (virtualized + pending-changes row)
    │   └── WorkingTreePanel + DiffPanel + ConflictPanel
    ├── StatusBar        ahead/behind, progress, cancel
    ├── PromptHost       confirm / prompt dialogs
    ├── SearchOverlay    commit + file search
    ├── InteractiveRebaseDialog
    └── AppSettingsDialog  layout, graph, sidebar preferences
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
| `git-light:preferences` | Panel sizes, collapsed state, graph/sidebar prefs (localStorage) |
| `recent-repos` | Recent repository list (electron-store, main) |
| `branch-favorites:{path}` | Per-repo pinned branches |

## Testing

- `src/lib/graph/computeGraphLayout.test.ts` — graph layout algorithm
- `src/lib/graph/graphEdgePath.test.ts` — SVG edge path generation
- `src/lib/graph/pendingGraphRow.test.ts` — pending-changes graph row
- `src/lib/graph/remapHeadLaneLeft.test.ts` — head lane remapping
- `src/lib/git/statusParser.test.ts` — status porcelain parser (renderer)
- `src/lib/git/refLabel.test.ts` — ref label formatting
- `src/lib/diff/buildSplitRows.test.ts` — split diff row builder
- `src/features/branch-sidebar/sortBranches.test.ts` — branch sort order
- `src/features/working-tree/buildFileTree.test.ts` — working-tree file tree
- `electron/git/ActionRouter.test.ts` — action → git argv routing
- `electron/git/ReflogJournal.test.ts` — undo/redo journal
- `electron/git/rebaseSequenceEditor.test.ts` — interactive rebase todo writer
- `electron/git/parsers/logParser.test.ts` — porcelain log parser
- `electron/git/parsers/commitFilesParser.test.ts` — commit file list parser
- `electron/git/parsers/conflictParser.test.ts` — merge conflict markers
- `electron/git/parsers/rebaseCommitsParser.test.ts` — rebase commit list
- `shared/diff/buildPatch.test.ts` — patch builder for hunk staging
- `shared/git/githubUrl.test.ts` — GitHub URL parsing
- `shared/git/undoPolicy.test.ts` — undo/redo eligibility

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
