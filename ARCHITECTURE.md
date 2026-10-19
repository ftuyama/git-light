# Architecture

Git Light is a Tauri 2 desktop app with a Vue 3 renderer. The UI depends on a `GitService` interface; the renderer never talks to Git directly — it invokes typed Tauri commands backed by a Rust git layer.

## Stack

| Layer | Technology |
|-------|------------|
| Shell | Tauri 2.12 (Rust backend + native window) |
| UI | Vue 3.5, Pinia 3, Tailwind v4, reka-ui |
| Build | Vite 7 + `tauri-cli` 2.12, TypeScript 6 |
| Git | Native `git` CLI spawned by Rust (`tokio::process`, argv arrays only) |
| Terminal | System terminal (external, via `git_open_terminal_external`) |
| File watch | `notify` crate → debounced `git:changed` events → scoped snapshot refresh |

## Process model

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer (Vue)                                              │
│  features/ → stores/repository + repoDiff → lib/tauri/tauriGitService    │
└───────────────────────────┬─────────────────────────────────┘
                            │ tauri::invoke (typed commands)
┌───────────────────────────▼─────────────────────────────────┐
│  Rust backend (src-tauri/)                                   │
│  main.rs commands → git.rs / log.rs / refs.rs / diff.rs /     │
│    actions.rs / watcher.rs                                    │
│              → snapshot builder + parsers                     │
│              → tauri-plugin-dialog / opener / os │
└─────────────────────────────────────────────────────────────┘
```

## Shared contracts

### App shell (`shared/app/`)

| Module | Purpose |
|--------|---------|
| `metadata.ts` | App name, version, homepage, repository URL (from `package.json`) |
| `credits.ts` | App links, third-party attribution list, `formatAboutCredits()` for native About panel |

### Git layer (`shared/git/`)

| Module | Purpose |
|--------|---------|
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

## Renderer git layer (`src/lib/tauri/` + `src/lib/git/`)

| File | Role |
|------|------|
| `GitService.ts` (`src/lib/git/`) | Interface the store depends on |
| `tauriGitService.ts` (`src/lib/tauri/`) | Production implementation via `@tauri-apps/api` `invoke` |
| `backendGate.ts` (`src/lib/tauri/`) | Holds repo-scoped commands until an in-flight `git_activate_repo` settles (cached tabs paint before the backend re-points) |
| `invoke.ts` (`src/lib/tauri/`) | Typed Tauri command wrappers (injectable invoker/listener) |
| `commands.ts` (`src/lib/tauri/`) | Health/version/recents/open/clone/init/discover command wrappers |
| `appBridge.ts` (`src/lib/tauri/`) | External URLs + window background (opener plugin) |
| `appMenu.ts` (`src/lib/tauri/`) | Native app/window menu (About, Check for Updates, Help) |
| `updater.ts` + `updateCheck.ts` (`src/lib/tauri/`) | GitHub Releases check, semver compare, snooze |
| `favorites.ts` (`src/lib/tauri/`) | Pinned-branch persistence bridge |
| `keybindings.ts` (`src/lib/`) | Central shortcut registry (`COMMAND_IDS`), defaults, conflict detection, persistence |
| `imageFiles.ts` / `imageZoom.ts` (`src/lib/`) | Image-path detection + zoom/pan transform helpers for `ImageDiffView` |
| `graphFilter.ts` (`src/lib/graph/`) | Local commit/stash matcher that dims non-matching graph rows during search |
| `MockGitService.ts` | Generated data; used when `VITE_USE_MOCK=true` (browser/dev) |
| `wireAdapter.ts` | Revives wire snapshots into domain types (`Date`, etc.) |
| `themes.ts` / `applyTheme.ts` | Theme catalog, system preference resolution, CSS variable application |
| `avatarCache.ts` | Cached author avatar images for commit rows |

Backend selection: `src/lib/backend.ts` (`isTauri()`) picks `tauriGitService`
in Tauri, mock when `VITE_USE_MOCK=true`.

## Rust backend (`src-tauri/src/`)

| File | Role |
|------|------|
| `main.rs` | Tauri builder, `#[tauri::command]` handlers, plugin init (dialog/opener/os), update-check compatible release flow |
| `repos.rs` | Onboarding: clone/init validation, folder discovery scan |
| `git.rs` | Snapshot builder, repo validation, recents + favorites |
| `log.rs` | Commit log fetch + parse, author registry, avatar URLs |
| `refs.rs` | Branches/tags/stashes/worktrees/remotes/status parsers |
| `diff.rs` | Diff/commit-files/search, conflict markers, rebase commits |
| `image.rs` | Binary image previews (size cap, data-URL sides for old/new) |
| `actions.rs` | Action router (`git_execute_action`), journal (undo/redo), cancellable runner with progress, rebase editor bundle |
| `watcher.rs` | `notify`-based repo watcher → debounced scoped `git:changed` events |

Config: `src-tauri/tauri.conf.json` (`beforeDevCommand: npm run dev:tauri`,
`frontendDist: ../dist`), `src-tauri/capabilities/default.json`,
`src-tauri/build.rs` (`tauri-build`). Tests live in `#[cfg(test)]` modules;
run `cargo test --manifest-path src-tauri/Cargo.toml`.

## Renderer stores (`src/stores/`)

| Store | Role |
|-------|------|
| `repository` | Repo lifecycle, commits, branches, git actions, commit box |
| `repoDiff` | Selected file, diff/conflict loading, commit/compare file lists |
| `selection` | Selected/hovered commit, shift-compare range |
| `branchDrag` | Branch drag-and-drop state and integrate dialog payload |
| `ui` | Layout prefs, graph columns, sidebar sections, theme |
| `interactiveRebase` | Interactive rebase dialog state |
| `prompt` / `toast` | Modal and toast UI |
| `repoTabs` | Open repository tabs, active tab, persistence (reopen closed, cycle, jump-to-index) |
| `repoTabCache` | Per-tab snapshot cache for fast tab switching |
| `gitOutput` | Per-repo executed-command log (capped) + drawer open state |

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
| `tabPreload.ts` | Warms the tab cache (`git_preload_repo`, no re-point) at startup, on hover, and on tab add |
| `actionHelpers.ts` | Shared action dispatch + error handling |

## UI layout

```
App.vue
├── StartupView          (no repo open: open/recent + CloneDialog + InitDialog + folder discovery)
└── main view
    ├── RepoTabs         multi-repo tab bar + repo switcher (reopen closed, cycle, jump-to-index)
    ├── RepoLoadingSkeleton  cold tab switch: three-pane skeleton (delayed 120ms) until the snapshot lands
    ├── Toolbar          remote/history actions, open external terminal
    ├── OperationBanner  merge/rebase/cherry-pick/revert in progress
    ├── SidebarRail      expand affordance when left/right pane collapsed
    ├── Splitpanes
    │   ├── BranchSidebar       (drag-drop integrate dialog, section context menus)
    │   ├── CommitGraph         (virtualized graph + diff/conflict overlay; ImageDiffView with zoom/pan/lightbox)
    │   └── WorkingTreePanel    (FileTypeIcon per path)
    ├── GitOutputDrawer  per-tab executed git commands (stdout/stderr, ok/error)
    ├── StatusBar        ahead/behind, progress, cancel, auto-fetch state
    ├── PromptHost       confirm / prompt dialogs
    ├── SearchOverlay    commit + file search
    ├── InteractiveRebaseDialog
    ├── BlameOverlay     blame view + file history side panel
    └── AppSettingsDialog  appearance (theme, UI mode), layout, changes, commits, graph, sidebar, sync (auto-fetch), shortcuts (remappable, conflict detection), credits
```

## Data flow

1. User opens repo → `git_open_repo` → `resolve_repo_info` (validated `RepoInfo`, cached per path for the run) → `git::build_snapshot_with_info()` → full snapshot over `invoke`.
2. `wireAdapter` revives dates; store runs `computeGraphLayout` on commits.
3. Switching to a cached tab paints `repoTabCache` synchronously and calls `git_activate_repo` in the background; `backendGate.ts` holds repo-scoped commands until it settles, while inactive tabs are warmed with `git_preload_repo` (never touches `current`/watcher/recents).
4. Mutations dispatch `GitAction` → Tauri command → git CLI → scoped `refreshSnapshot`.
5. External edits trigger watcher → same refresh path.
6. Undo/redo uses the Rust-side journal (checkpoint before each journalable action) with reset/checkout restore per `undoPolicy`.

## Persistence

| Key | Storage |
|-----|---------|
| `git-light:preferences` | Panel sizes, collapsed state, theme, graph/sidebar prefs, open repo tabs (localStorage) |
| `recent-repos` | Recent repository list (Rust side: app-data `recent-repos.json`) |
| `branch-favorites` | Per-repo pinned branches (Rust side: app-data `favorites.json`) |
| `git-light:update-snooze` | Skipped update version for the startup check (localStorage) |

## Testing

Frontend unit tests live next to the code as `*.test.ts` under `src/` and `shared/` (graph layout, diff helpers, Tauri bridges, shared contracts, stores). Rust tests live in `#[cfg(test)]` modules inside `src-tauri/src/` — parsers (log/refs/diff), journal policy, runner, plus live integration tests against temp repos and the repo itself.

Run: `npm run test` + `cargo test --manifest-path src-tauri/Cargo.toml`

## Extension points

- **New git operation:** add kind to `shared/git/actions.ts`, route it in `src-tauri/src/actions.rs`, wire UI.
- **New snapshot field:** extend wire model + Rust parser + `wireAdapter` + store state.
- **Replace CLI backend:** implement `GitService` without touching Vue features.

## Security notes

- Tauri renderer has no Node access; git runs only in Rust via argv arrays (no shell interpolation). Frontend allowlist lives in `src-tauri/capabilities/default.json`.
- Git commands use argv arrays (no shell interpolation).
- Paths passed to git are validated (`assertPathInsideRepo` in TS, `validate_repo` in Rust).
