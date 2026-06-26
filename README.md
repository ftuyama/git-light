# Git Light

A desktop Git client with a GitKraken-inspired interface — commit graph, branch sidebar, working tree panel, and real local repository operations.

**[ftuyama.github.io/git-light](https://ftuyama.github.io/git-light/)** · MIT License

![Git Light — repository view](docs/screenshot.png)

## What is this?

Git Light is an Electron app that recreates GitKraken's main repository view and runs **real Git commands** against local repositories via a typed IPC layer. Open a folder, browse history, manage branches, stage files, commit, fetch/pull/push, and inspect diffs.

## Features

| Area | Status |
|------|--------|
| Real Git backend (`git` CLI in main process; renderer never shells out) | ✅ |
| Open local repos · recent repos · startup screen | ✅ |
| Commit graph — lanes, refs, pagination, shift-compare, keyboard nav | ✅ |
| Branch sidebar — favorites, tags, stashes, worktrees; drag-and-drop merge/rebase | ✅ |
| Working tree — flat/tree view, stage/unstage (patch hunks), commit | ✅ |
| Diff viewer — unified/split, syntax highlighting, per-hunk staging | ✅ |
| Fetch / pull / push / sync | ✅ |
| Merge / rebase / interactive rebase / cherry-pick (continue/abort banner) | ✅ |
| Merge conflict resolution (ours/theirs/per-block) | ✅ |
| Undo / redo (reflog-backed) · stash · search | ✅ |
| Open on GitHub · app preferences (layout, graph, sidebar) | ✅ |
| Resizable three-pane layout · file watcher auto-refresh | ✅ |
| Clone / hosting auth UI | ❌ Not yet |

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
| `npm run test` | Unit tests (graph layout, parsers, rebase, conflicts, undo) |

## Sponsor

If Git Light is useful to you, consider supporting ongoing development:

**[Sponsor on Ko-fi](https://ko-fi.com/lelouchiee)**

## For developers

Architecture, stack, and extension points are documented in **[ARCHITECTURE.md](ARCHITECTURE.md)**.
