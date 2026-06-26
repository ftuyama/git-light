# Git Light

A desktop Git client with a GitKraken-inspired interface — commit graph, branch sidebar, working tree panel, and real local repository operations.

**[ftuyama.github.io/git-light](https://ftuyama.github.io/git-light/)** · MIT License

![Git Light — repository view](docs/screenshot.png)

## What is this?

Git Light is an Electron app that recreates GitKraken's main repository view and runs **real Git commands** against local repositories via a typed IPC layer. Open a folder, browse history, manage branches, stage files, commit, fetch/pull/push, and inspect diffs.

## Features

- **Real Git backend** — native `git` CLI in the Electron main process (renderer never shells out)
- Commit graph with colored lanes, refs, infinite scroll, and keyboard navigation
- Branch sidebar — favorites, local/remote branches, tags, stashes, worktrees
- Working tree — stage/unstage, commit, conflict section, unified diff panel
- Toolbar — fetch, pull, push, merge, rebase, stash, cherry-pick, undo/redo, search
- App preferences — panel layout, graph columns, sidebar sections, commit history limit
- Startup screen with recent repositories and open-folder dialog
- File watcher with debounced auto-refresh on external changes
- Resizable three-pane layout with persisted panel sizes
- Operation banner for merge/rebase/cherry-pick/revert in progress

## Quick start

**Requirements:** Node.js 20+, Git installed on your PATH

```bash
git clone https://github.com/ftuyama/git-light.git
cd git-light
npm install
npm run dev
```

### Running from Cursor or VS Code

If the app window does not open, your terminal may have inherited `ELECTRON_RUN_AS_NODE=1` from the editor:

```bash
env -u ELECTRON_RUN_AS_NODE -u ELECTRON_NO_ATTACH_CONSOLE npm run dev
```

### Mock data mode (browser / UI-only)

To run the generated AwesomeShop mock data without Electron Git:

```bash
VITE_USE_MOCK=true npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Electron + Vite dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Unit tests (graph layout, parsers, ref labels) |

## What works today

| Area | Status |
|------|--------|
| Open local repositories | ✅ |
| Commit graph + pagination | ✅ |
| Stage / commit / branch ops | ✅ |
| Fetch / pull / push / sync | ✅ |
| Merge / rebase / cherry-pick (with continue/abort banner) | ✅ |
| Diff viewer (unified) | ✅ |
| Commit & file search | ✅ |
| App preferences (layout, graph, sidebar) | ✅ |
| Clone / hosting auth UI | ❌ Not yet |

## Sponsor

If Git Light is useful to you, consider supporting ongoing development:

**[Sponsor on Ko-fi](https://ko-fi.com/lelouchiee)**

## For developers

Architecture, stack, and extension points are documented in **[ARCHITECTURE.md](ARCHITECTURE.md)**.
