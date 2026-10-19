<p align="center">
  <img src="docs/icon.png" alt="Git Light" width="96" height="96" />
</p>

# Git Light

> Free, open-source desktop Git client — commit graph, branches, staging and real local Git operations. No account required.

[![Latest release](https://img.shields.io/github/v/release/ftuyama/git-light)](https://github.com/ftuyama/git-light/releases) [![License: MIT](https://img.shields.io/github/license/ftuyama/git-light)](LICENSE) [![Downloads](https://img.shields.io/github/downloads/ftuyama/git-light/total)](https://github.com/ftuyama/git-light/releases) [![Stars](https://img.shields.io/github/stars/ftuyama/git-light?style=flat)](https://github.com/ftuyama/git-light/stargazers) [![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)](https://github.com/ftuyama/git-light/releases)

**[ftuyama.github.io/git-light](https://ftuyama.github.io/git-light/)** · MIT License · Built with Tauri 2, Vue 3, TypeScript, Rust

![Git Light — AwesomeShop repository with repo tabs, commit graph, branch sidebar, and working tree](docs/screenshot.png)

Git Light is a lightweight app for browsing history, managing branches, staging changes and running fetch/pull/push — using real Git commands on your local repos. Open a folder, clone a URL, or init a new repo.

## Features

- Commit graph with lanes, refs, search + keyboard navigation
- Branch sidebar: favorites, tags, stashes, worktrees, drag-and-drop merge/rebase
- Working tree with hunk staging, conflict editor, sign-off / GPG commits
- Diff viewer: unified/split, syntax highlighting, blame + file history, image diffs
- Merge / rebase / interactive rebase / cherry-pick / bisect
- Undo / redo, stash, force-push with lease
- Fetch / pull / push / sync + auto-fetch
- Multi-repo tabs, command palette (⌘K), custom shortcuts
- Git output log for every command
- Clone / init / folder discovery, terminal at repo root (⌘T)
- Themes, Basic/Advanced UI mode, resizable layout + auto-refresh
- LFS support, auto-update check, Open on GitHub

## Why Git Light?

| | Git Light | GitKraken | GitHub Desktop | Sourcetree |
|---|---|---|---|---|
| Free + open-source (MIT) | ✅ | ❌ | ✅* | ✅ free, ❌ closed |
| No account required | ✅ | ❌ | ✅ | ❌ |
| Commit graph + branches + staging | ✅ | ✅ | ✅ | ✅ |
| Hunk staging + conflict editor | ✅ | ✅ | partial | ✅ |
| Merge / rebase / cherry-pick | ✅ | ✅ | partial | ✅ |
| Interactive rebase | ✅ | ✅ | ❌ | ✅ |
| Undo / redo + stash | ✅ | ✅ | partial | partial |
| Image diffs + blame + file history | ✅ | ✅ | partial | partial |
| Multi-repo tabs | ✅ | ✅ | ❌ | ✅ |
| Command palette + custom shortcuts | ✅ | partial | ❌ | ❌ |
| macOS / Windows / Linux | ✅ | ✅ | ✅ / ✅ / ❌** | ✅ / ✅ / ❌ |
| Lightweight, offline-first | ✅ | ❌ heavy | ✅ | ❌ heavy |

\* GitHub Desktop is open-source but GitHub-centric. \*\* No official Linux build.

## Download

**macOS (recommended, no Gatekeeper prompts):**

```bash
curl -fsSL https://raw.githubusercontent.com/ftuyama/git-light/main/scripts/install.sh | sh
```

Installs to /Applications from GitHub Releases, checksum-verified. Re-running it installs the latest version (acts as updater). Browsers flag `.dmg` downloads with a quarantine notice; this doesn't.

**Native installers** — from **[GitHub Releases](https://github.com/ftuyama/git-light/releases/latest)**:

| Platform | File | Install |
|----------|------|---------|
| macOS | `.dmg` | Drag to Applications; if macOS blocks it, see the [note below](#macos-gatekeeper-note) |
| Windows | `.exe` | Run the installer |
| Linux | `.AppImage` or `.deb` | Make executable and run / `sudo dpkg -i git-light_*.deb` |

### macOS Gatekeeper note

Builds are ad-hoc signed, so macOS 15+ may refuse a browser-downloaded app ("move to the Trash"). Nothing is wrong with the download. Either use the `curl | sh` install above, or run once:

```bash
codesign --force --deep --sign - "/Applications/Git Light.app"
xattr -dr com.apple.quarantine "/Applications/Git Light.app"
```

Updates: **Git Light → Check for Updates…** in the app menu (macOS installs and restarts in place).

## Sponsor

Useful? **[Sponsor on Ko-fi](https://ko-fi.com/lelouchiee)**

## For developers

Build instructions in **[DEVELOPER.md](DEVELOPER.md)** · architecture in **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---
*Git Light is independent and not affiliated with GitKraken, GitHub, or Atlassian. Names mentioned for comparison only.*
