# Developer guide

**Requirements:** Node.js 20+, Git installed on your PATH

## Build from source

```bash
git clone https://github.com/ftuyama/git-light.git
cd git-light
npm install
npm run dev
```

## Running from Cursor or VS Code

If the app window does not open, your terminal may have inherited `ELECTRON_RUN_AS_NODE=1` from the editor:

```bash
env -u ELECTRON_RUN_AS_NODE -u ELECTRON_NO_ATTACH_CONSOLE npm run dev
```

## Mock data mode (browser / UI-only)

To run the generated AwesomeShop mock data without Electron Git:

```bash
VITE_USE_MOCK=true npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Electron + Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run dist` | Build installer for current platform |
| `npm run dist:mac` | Build a macOS `.dmg` installer (requires macOS) |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Unit tests (graph layout, parsers, rebase, conflicts, undo) |
| `npm run test:watch` | Run tests in watch mode |

## Architecture

Architecture, stack, and extension points are documented in **[ARCHITECTURE.md](ARCHITECTURE.md)**.

## Creating a release

Releases are versioned with git tags (`v*`). Pushing a tag triggers GitHub Actions to build a macOS `.dmg` and attach it to a [GitHub Release](https://github.com/ftuyama/git-light/releases).

### Overview

```text
1. Update docs & bump version in package.json
2. Run tests
3. Commit → tag vX.Y.Z → push commit + tag
4. CI builds dist/*.dmg and publishes the release
```

The packaged app checks for updates by comparing its version against the latest GitHub release tag. Users can also check manually via **Git Light → Check for Updates…** in the menu bar.

### 1. Prepare the release

Before bumping the version:

1. **Sync documentation** so it matches the current codebase:
   - [README.md](README.md) — feature table, install notes
   - [ARCHITECTURE.md](ARCHITECTURE.md) — stack versions, file layout
   - [docs/index.html](docs/index.html) — landing page copy and install section
2. **Refresh the screenshot** if the UI changed. Run mock mode, capture the main view at 1440×900, and overwrite [docs/screenshot.png](docs/screenshot.png):

   ```bash
   VITE_USE_MOCK=true npm run dev
   ```

3. **Verify** the tree is healthy:

   ```bash
   npm run typecheck
   npm run test
   ```

### 2. Bump the version

Update `"version"` in [package.json](package.json) and the matching entries in `package-lock.json` (top-level `"version"` and `"packages".""`).

Use [semver](https://semver.org/):

| Bump | Example |
|------|---------|
| Patch | `0.1.2` → `0.1.3` |
| Minor | `0.1.2` → `0.2.0` |
| Major | `0.1.2` → `1.0.0` |

If `docs/index.html` shows a version badge or footer version, update it to match.

Confirm the tag does not already exist:

```bash
git tag -l 'v*'
```

### 3. Commit and tag

Stage all release changes (docs, version bump, and any pending source changes):

```bash
git add -A
git diff --cached --stat   # review what will ship
```

Commit and create an annotated tag (replace `X.Y.Z` with the new version):

```bash
git commit -m "Release vX.Y.Z

<short summary of what changed since the last release>"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

### 4. Push and publish

Push the commit and tag to `main`:

```bash
git push origin main
git push origin vX.Y.Z
```

The [Release workflow](.github/workflows/release.yml) runs on `macos-latest` when a `v*` tag is pushed. It runs `npm ci`, `npm run dist:mac`, and uploads `dist/*.dmg` to the GitHub Release via `softprops/action-gh-release`.

Monitor the run under **Actions** on GitHub. When it succeeds, the DMG appears on the release page.

### 5. Verify the release

1. Open the new release on GitHub and confirm the `.dmg` asset is attached.
2. Download and install the DMG on a Mac (unsigned builds may require **Right-click → Open** on first launch).
3. Launch the app and use **Git Light → Check for Updates…** — it should report you are on the latest version.

### Build a DMG locally (optional)

To test packaging before pushing a tag (requires macOS):

```bash
npm run dist:mac
```

Output lands in `dist/` (e.g. `dist/Git Light-0.1.3-arm64.dmg`). Builds are unsigned for now; code signing can be added later via `build.mac` in `package.json`.

### Cursor release command

In Cursor, you can run the **`/release`** command (see [.cursor/commands/release.md](.cursor/commands/release.md)) to automate doc sync, version bump, verification, commit, and tagging. You still need to push the commit and tag yourself to trigger CI.
