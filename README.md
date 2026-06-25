# Git Light

A desktop Git client with a GitKraken-inspired interface — commit graph, branch sidebar, and working tree panel in a polished dark UI.

**[ftuyama.github.io/git-light](https://ftuyama.github.io/git-light/)** · MIT License

![Git Light — AwesomeShop repository view](docs/screenshot.png)

## What is this?

Git Light is a **UI shell** that recreates GitKraken's main repository view. You can explore branches, scroll the commit graph, stage files, and use the toolbar — all with realistic mock data.

It is **not a working Git client yet.** Buttons respond and the interface feels alive, but no real repositories are read or modified. The goal is a pixel-perfect front end that a real Git backend can plug into later.

## Features

- Commit graph with colored lanes, refs, and keyboard navigation
- Branch sidebar — favorites, local branches, remotes, tags, stashes, worktrees
- Working tree — unstaged, staged, and conflict sections with a commit box
- Toolbar with pull, push, fetch, merge, rebase, stash, and related actions
- Resizable three-pane layout with persisted panel sizes
- Dark-first design tuned for long sessions

## Quick start

**Requirements:** Node.js 20+

```bash
git clone https://github.com/ftuyama/git-light.git
cd git-light
npm install
npm run dev
```

### Running from Cursor or VS Code

If the app window does not open, your terminal may have inherited `ELECTRON_RUN_AS_NODE=1` from the editor. Clear it first:

```bash
env -u ELECTRON_RUN_AS_NODE -u ELECTRON_NO_ATTACH_CONSOLE npm run dev
```

## What works today

| Area | Status |
|------|--------|
| Main repository view | Implemented |
| Real Git operations | Not implemented (mocked) |
| Settings, cloning, auth | Not implemented |
| Diff viewer | Not implemented |

## For developers

Architecture, stack, project layout, and extension points are documented in **[ARCHITECTURE.md](ARCHITECTURE.md)**.
