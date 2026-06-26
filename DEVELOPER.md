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
| `npm run dist:analyze` | Print DMG / `.app` / ASAR size breakdown (run after `dist:mac`) |
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

Then sync the landing page version markers:

```bash
npm run sync-version
```

The app reads `package.json` at build time (`shared/app/metadata.ts`); only `docs/index.html` needs this extra step.

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
2. Download and install the DMG on a Mac. Notarized builds open normally; ad-hoc signed builds may require **Right-click → Open** on first launch.
3. Launch the app and use **Git Light → Check for Updates…** — it should report you are on the latest version.

### macOS code signing

Release builds are packaged by [`scripts/dist-mac.mjs`](scripts/dist-mac.mjs):

| CI secrets configured | Result |
|------------------------|--------|
| None | Ad-hoc signed DMG (valid bundle signature; first launch may need **Right-click → Open**) |
| Apple certificate only | Developer ID signed DMG |
| Apple certificate + notarization secrets | Developer ID signed + notarized DMG (opens normally for all users) |

CI verifies every release with `npm run verify:mac-signing` so broken bundles cannot ship.

#### Notarized releases (recommended)

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/).
2. Create a **Developer ID Application** certificate and export it as a `.p12`.
3. Add these GitHub repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|--------|
| `APPLE_CERTIFICATE_BASE64` | Base64-encoded `.p12` (`base64 -i cert.p12 \| pbcopy`) |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` export |
| `APPLE_ID` | Apple ID email used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from [appleid.apple.com](https://appleid.apple.com) |
| `APPLE_TEAM_ID` | Team ID from Apple Developer → Membership |

4. Add the secrets to the **Build signed DMG** step in [`.github/workflows/release.yml`](.github/workflows/release.yml):

```yaml
env:
  CSC_LINK: ${{ secrets.APPLE_CERTIFICATE_BASE64 }}
  CSC_KEY_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  APPLE_ID: ${{ secrets.APPLE_ID }}
  APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
  APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

5. Push a release tag — CI signs and notarizes automatically.

To test notarized packaging locally, export the same env vars and run `npm run dist:mac`.

### Build a DMG locally (optional)

To test packaging before pushing a tag (requires macOS):

```bash
npm run dist:mac
npm run verify:mac-signing
npm run dist:analyze
```

Output lands in `dist/` (e.g. `dist/Git Light-0.1.3-arm64.dmg`). `dist:analyze` reports DMG size, installed `.app` size, ASAR contents, locale count, and renderer asset sizes. Local builds use ad-hoc signing unless Apple certificate env vars are set.

### Cursor release command

In Cursor, you can run the **`/release`** command (see [.cursor/commands/release.md](.cursor/commands/release.md)) to automate doc sync, version bump, verification, commit, and tagging. You still need to push the commit and tag yourself to trigger CI.
