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
│  features/ → stores/repository → lib/git/IpcGitService       │
└───────────────────────────┬─────────────────────────────────┘
                            │ contextBridge (typed IPC)
┌───────────────────────────▼─────────────────────────────────┐
│  Main process                                                │
│  registerIpc → GitProvider → GitCliProvider + parsers          │
│              → RepositoryWatcher (chokidar)                    │
│              → ActionRouter (GitAction → git argv)           │
└─────────────────────────────────────────────────────────────┘
```

## Shared contracts (`shared/git/`)

| Module | Purpose |
|--------|---------|
| `ipc.ts` | Channel names + `IpcContract` request/response tuples |
| `models.ts` | Wire types (ISO date strings, serializable snapshots) |
| `actions.ts` | `GitActionKind` + `GitAction` — single source of truth |
| `errors.ts` | `GitError`, `classifyGitError()`, serialized error payloads |

## Renderer git layer (`src/lib/git/`)

| File | Role |
|------|------|
| `GitService.ts` | Interface the store depends on |
| `IpcGitService.ts` | Production implementation via `window.electron.git` |
| `MockGitService.ts` | Generated data; used when `VITE_USE_MOCK=true` or outside Electron |
| `wireAdapter.ts` | Revives wire snapshots into domain types (`Date`, etc.) |
| `destructive.ts` | Actions that require confirmation in the UI |

## Main-process git layer (`electron/git/`)

| File | Role |
|------|------|
| `GitCliProvider.ts` | Spawns `git` with argument arrays only |
| `GitProvider.ts` | Open/validate repo, snapshot, pagination, execute, diff, search |
| `ActionRouter.ts` | Maps each `GitActionKind` to git commands |
| `RepoCache.ts` | TTL cache for status/branches |
| `RepositoryWatcher.ts` | Debounced filesystem events → `git:changed` |
| `parsers/` | Parse porcelain log, status, branches, diffs, etc. |

## UI layout

```
App.vue
├── StartupView          (no repo open)
└── main view
    ├── Toolbar          remote/history actions, repo switcher
    ├── OperationBanner  merge/rebase/cherry-pick/revert in progress
    ├── Splitpanes
    │   ├── BranchSidebar
    │   ├── CommitGraph  (virtualized + infinite scroll)
    │   └── WorkingTreePanel + DiffPanel
    ├── StatusBar        ahead/behind, progress, cancel
    ├── PromptHost       confirm / prompt dialogs
    └── SearchOverlay    commit + file search
```

## Data flow

1. User opens repo → `git:open-repo` → `GitProvider.open()` → full snapshot over IPC.
2. `wireAdapter` revives dates; store runs `computeGraphLayout` on commits.
3. Mutations dispatch `GitAction` → `ActionRouter` → git CLI → cache invalidation → `git:changed` → scoped `refreshSnapshot`.
4. External edits trigger chokidar → same refresh path.

## Persistence

| Key | Storage |
|-----|---------|
| `git-light:ui` | Panel sizes, collapsed state (electron-store / localStorage) |
| `recent-repos` | Recent repository list (electron-store, main) |
| `branch-favorites:{path}` | Per-repo pinned branches |

## Testing

- `src/lib/graph/computeGraphLayout.test.ts` — graph layout algorithm
- `src/lib/git/statusParser.test.ts` — status porcelain parser

Run: `npm run test`

## Extension points

- **New git operation:** add kind to `shared/git/actions.ts`, route in `ActionRouter.ts`, wire UI.
- **New snapshot field:** extend wire model + parser + `wireAdapter` + store state.
- **Replace CLI backend:** implement `GitService` without touching Vue features.

## Security notes

- Renderer is sandboxed with `contextIsolation: true`; only preload exposes IPC.
- Git commands use argv arrays (no shell interpolation).
- Paths passed to git are validated with `assertPathInsideRepo`.
