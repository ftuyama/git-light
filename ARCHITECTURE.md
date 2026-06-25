# Architecture

Technical reference for contributors and anyone extending Git Light.

## Overview

Git Light is an Electron desktop app with a Vue 3 renderer. The UI is built around a `GitService` interface so the renderer never talks to Git directly. Today that interface is fulfilled by `MockGitService`, which serves seeded data from `generateAwesomeShop` and resolves actions after a short delay to mimic real latency.

Swapping in a real implementation — CLI wrapper, libgit2, or isomorphic-git — should require no component changes, only a new service class wired through the preload IPC bridge.

## Stack

| Layer | Technology |
|-------|------------|
| Desktop shell | Electron 41, electron-vite |
| UI framework | Vue 3 (`<script setup>`), TypeScript (strict) |
| Styling | Tailwind CSS v4, reka-ui primitives |
| State | Pinia, `electron-store` for persisted UI sizes |
| Lists | `@tanstack/vue-virtual` for commit and file lists |
| Motion & icons | motion-v, @lucide/vue |
| Graph | Custom layout engine (`computeGraphLayout`) — no graph library |
| Tests | Vitest |

## Project layout

```
electron/            Main process + preload (typed IPC: window.electron)
src/
  components/ui/     Reusable primitives (Button, Tooltip, ContextMenu, Checkbox, …)
  features/
    toolbar/         GitKraken-style action toolbar
    branch-sidebar/  Repository explorer (branches, tags, stashes, worktrees)
    commit-graph/    Virtualized commit graph (SVG lanes + DOM rows)
    working-tree/    Changes / staged / conflicts + commit box
    status-bar/      Repository status footer
    layout/          Collapsed rails, toast viewport
  stores/            Pinia stores (ui, repository, selection, toast)
  lib/
    git/             GitService interface + MockGitService
    graph/           computeGraphLayout (pure, unit-tested)
  data/              generateAwesomeShop seeded mock data
  types/             Domain types
docs/                GitHub Pages landing site
```

## Data flow

```
┌─────────────┐     GitService      ┌──────────────────┐
│  Vue UI     │ ◄────────────────── │  MockGitService  │  (today)
│  components │                     │  generateAwesome │
└─────────────┘                     └──────────────────┘
       ▲
       │  future: RealGitService via preload IPC
       ▼
┌─────────────┐
│  Electron   │
│  main/git   │
└─────────────┘
```

1. Pinia stores call methods on `GitService` (load repo, stage file, commit, etc.).
2. `MockGitService` returns in-memory data and simulates latency on mutations.
3. Components react to store state; they have no knowledge of whether the backend is mock or real.

The interface lives at `src/lib/git/GitService.ts`. Any real backend must implement the same contract.

## Commit graph engine

The graph is rendered by a purpose-built engine, not a generic node library.

1. **`computeGraphLayout`** (`src/lib/graph/computeGraphLayout.ts`) — pure function that assigns each commit to a lane and emits per-band edge segments. Covered by unit tests.
2. **`CommitGraph.vue`** — virtualizes rows with `@tanstack/vue-virtual`. Draws only the SVG segments and nodes intersecting the visible viewport.
3. **Result** — smooth scrolling with hundreds of commits and GitKraken-style lane merging.

## Pinia stores

| Store | Responsibility |
|-------|----------------|
| `repository` | Commits, branches, files, HEAD; delegates actions to `GitService` |
| `ui` | Panel sizes, collapsed sidebars; persisted via `electron-store` |
| `selection` | Selected commit index; keyboard navigation |
| `toast` | Operation feedback notifications |

## Electron IPC

The preload script exposes a typed `window.electron` bridge. The main process handles:

- `electron-store` read/write for UI preferences
- External URL opening
- Future Git command execution

Renderer code should not import Node or Electron APIs directly.

## Scope

Only the **main repository view** is implemented:

- Toolbar, branch sidebar, commit graph, working-directory panel, status bar

Not implemented:

- Settings, onboarding, authentication, cloning, diff viewer
- Real Git read/write

## Scripts

```bash
npm run dev          # Electron + Vite dev server
npm run build        # Production build (main + preload + renderer)
npm run preview      # Preview production renderer
npm run typecheck    # vue-tsc strict check
npm run test         # Vitest (graph layout engine)
npm run test:watch   # Vitest in watch mode
```

## Extending with a real Git backend

1. Implement `GitService` in `src/lib/git/` (e.g. `CliGitService.ts`).
2. Add IPC handlers in `electron/main.ts` for git subprocess calls or native bindings.
3. Expose safe methods through `electron/preload.ts`.
4. Swap the service instance in the store bootstrap (`src/stores/repository.ts`).

Keep all Git I/O in the main process or a dedicated worker — the renderer stays sandboxed.

## Design system

Colors and spacing follow a GitKraken-inspired dark theme defined in `src/assets/theme.css`:

- Near-black app surface (`--color-app`)
- Raised panels and muted borders
- Eight rotating lane colors for branch graph lines
- Inter (UI) and JetBrains Mono (SHAs, paths)
