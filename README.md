<p align="center">
  <img src="docs/icon.png" alt="Git Light" width="96" height="96" />
</p>

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
| Integrated terminal (xterm + node-pty, ⌘T toggle in graph pane) | ✅ |
| Themes — Default, Dracula, Light, Claude, System (settings) | ✅ |
| Collapsible sidebars with expand rails · commit graph zoom | ✅ |
| Open on GitHub · app preferences (appearance, layout, graph, sidebar, credits) | ✅ |
| Credits & attribution (settings panel + native About dialog) | ✅ |
| Resizable three-pane layout · file watcher auto-refresh | ✅ |
| Auto-update check (packaged builds) · **Check for Updates…** menu | ✅ |
| Clone / hosting auth UI | ❌ Not yet |

## Quick start

Download the latest `.dmg` from **[GitHub Releases](https://github.com/ftuyama/git-light/releases)**.

1. Open the DMG and drag **Git Light** into **Applications**.
2. Launch **Git Light** from Applications. Notarized releases open normally; ad-hoc signed builds may require **Right-click → Open → Open** on first launch.
3. To check for updates later, use **Git Light → Check for Updates…** in the menu bar.

## Sponsor

If Git Light is useful to you, consider supporting ongoing development:

**[Sponsor on Ko-fi](https://ko-fi.com/lelouchiee)**

## For developers

See **[DEVELOPER.md](DEVELOPER.md)** for build instructions, scripts, and local development setup. Architecture, stack, and extension points are in **[ARCHITECTURE.md](ARCHITECTURE.md)**.
