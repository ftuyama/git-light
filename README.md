# Git Light

A GitKraken-style desktop Git client **UI shell**, built to prioritize an exceptional, pixel-perfect interface over backend functionality. It recreates the look and feel of GitKraken's main repository view with realistic mocked data.

This is intentionally **not** a working Git client. Every button exists and every interaction feels alive, but Git operations are mocked. The architecture is designed so a real Git backend (CLI, libgit2, or isomorphic-git) can be connected later without a UI rewrite.

## Stack

- **Electron** + **electron-vite** — desktop shell with a single `dev` command
- **Vue 3** (`<script setup>`) + **TypeScript** (strict)
- **Tailwind CSS v4** + **reka-ui** primitives (shadcn-vue style)
- **Pinia** for state, persisted UI sizes via `electron-store`
- **@tanstack/vue-virtual** for virtualized commit and file lists
- **motion-v** for subtle animations, **@lucide/vue** for icons
- A **custom commit-graph layout engine** (not a graph library) for GitKraken-quality lanes

## Getting started

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build      # type-agnostic production build (main + preload + renderer)
npm run typecheck  # vue-tsc strict type check
npm run test       # vitest unit tests (graph layout engine)
```

## Architecture

```
electron/            Electron main + preload (typed IPC bridge: window.electron)
src/
  components/ui/     Reusable primitives (Button, Tooltip, ContextMenu, Checkbox, ...)
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
```

### Data flow

The renderer never talks to Git directly. It depends only on the `GitService`
interface (`src/lib/git/GitService.ts`). Today that is fulfilled by
`MockGitService`, which serves seeded data from `generateAwesomeShop` and
resolves actions after a short delay to mimic real latency. Swapping in a real
implementation that calls `git` through the preload IPC bridge requires no
component changes.

### Commit graph

The graph is rendered by a purpose-built engine rather than a generic node
library. `computeGraphLayout` assigns each commit to a lane and emits per-band
edge segments; the component draws only the segments and nodes intersecting the
virtualized viewport, so it stays smooth with hundreds of commits.

## Scope

Only the **main repository view** is implemented: toolbar, branch sidebar,
commit graph, working-directory panel, and status bar. There is no settings,
onboarding, authentication, cloning, or diff viewer.

## Note on running inside Cursor's terminal

If you launch `npm run dev` from a terminal spawned by an Electron-based editor,
the inherited `ELECTRON_RUN_AS_NODE=1` variable will prevent the GUI from
opening. Run with it cleared:

```bash
env -u ELECTRON_RUN_AS_NODE -u ELECTRON_NO_ATTACH_CONSOLE npm run dev
```
