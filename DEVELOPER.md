# Developer guide

**Requirements:** Node.js 20+, Rust stable (via rustup) + `cargo`, Git installed on your PATH

## Build from source

```bash
git clone https://github.com/ftuyama/git-light.git
cd git-light
npm install
npm run dev
```

`npm run dev` = `tauri dev` (Vite on :1420 + native window).

## Mock data mode (browser / UI-only)

To run the generated AwesomeShop mock data without the Tauri backend:

```bash
VITE_USE_MOCK=true npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Tauri dev window + Vite dev server |
| `npm run dev:tauri` | Vite only in Tauri mode (no native window) |
| `npm run build` | Frontend-only production build (`dist/`, web preview) |
| `npm run build:tauri` | Frontend build used by Tauri (`tauri.conf.json` `beforeBuildCommand`, outputs `dist/`) |
| `npm run dist:tauri` | Full Tauri bundle (`tauri build`) |
| `npm run preview` | Preview production build |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Unit tests (graph layout, Tauri bridges, shared contracts) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run rust:check` | `cargo check` (Tauri backend) |
| `npm run rust:clippy` | `cargo clippy -D warnings` |
| `npm run rust:fmt:check` | `cargo fmt --check` |
| `npm run rust:test` | `cargo test` |
| `npm run check` | `typecheck` + `clippy` + `fmt:check` |

## Architecture

Architecture, stack, and extension points are documented in **[ARCHITECTURE.md](ARCHITECTURE.md)**.

## Creating a release

Releases are versioned with git tags (`v*`). Pushing a tag triggers GitHub Actions to build installers for **macOS, Windows, and Linux** and attach them to a [GitHub Release](https://github.com/ftuyama/git-light/releases).

### Overview

```text
1. Update docs & bump version in package.json
2. Run tests
3. Commit → tag vX.Y.Z → push commit + tag
4. CI builds macOS .dmg, Windows .exe, Linux .AppImage + .deb and publishes the release
```

The packaged app checks for updates by comparing its version against the latest GitHub release tag. Users can also check manually via **Git Light → Check for Updates…** in the menu bar.

### 1. Prepare the release

Before bumping the version:

1. **Sync documentation** so it matches the current codebase:
   - [README.md](README.md) — feature table, install notes
   - [ARCHITECTURE.md](ARCHITECTURE.md) — stack versions, file layout
   - [docs/index.html](docs/index.html) — landing page copy and install section
   - [docs/llms.txt](docs/llms.txt) — AI-readable site summary (version synced automatically)
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

Update `"version"` in [package.json](package.json) only, then sync derived markers:

```bash
npm run sync-version
```

Use [semver](https://semver.org/):

| Bump | Example |
|------|---------|
| Patch | `0.1.2` → `0.1.3` |
| Minor | `0.1.2` → `0.2.0` |
| Major | `0.1.2` → `1.0.0` |

Then sync version markers across docs:

```bash
npm run sync-version
```

The app reads `package.json` at build time (`shared/app/metadata.ts`); `sync-version` propagates the version to `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `docs/index.html`, `docs/llms.txt` and `docs/llms-full.txt`.

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

The [Release workflow](.github/workflows/release.yml) runs on every OS in the matrix when a `v*` tag is pushed. It runs `npm ci` plus the typecheck/test/clippy/fmt gates, then builds Tauri bundles via `tauri-apps/tauri-action` and attaches them to the GitHub Release.

Monitor the run under **Actions** on GitHub. When it succeeds, the DMG appears on the release page.

### 5. Verify the release

1. Open the new release on GitHub and confirm the platform assets are attached (`.dmg` on macOS, installer on Windows, `.AppImage`/`.deb` on Linux).
2. Download and install the asset for your platform. Notarized macOS builds open normally; ad-hoc signed builds may require **Right-click → Open** on first launch.
3. Launch the app and use **Git Light → Check for Updates…** — it should report you are on the latest version.

### macOS code signing

Release builds are signed by Tauri at `tauri build` time from environment secrets:

| CI secrets configured | Result |
|------------------------|--------|
| None | Ad-hoc signed DMG (valid bundle signature; first launch may need **Right-click → Open**) |
| Apple certificate only | Developer ID signed DMG |
| Apple certificate + notarization secrets | Developer ID signed + notarized DMG (opens normally for all users) |

CI verifies every release with the typecheck/test/clippy/fmt gates in `release.yml` so broken bundles cannot ship.

#### Notarized releases (recommended)

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/).
2. Create a **Developer ID Application** certificate and export it as a `.p12`.
3. Add these GitHub repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|--------|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` (`base64 -i cert.p12 \| pbcopy`) |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` export |
| `APPLE_SIGNING_IDENTITY` | Developer ID Application identity |
| `APPLE_ID` | Apple ID email used for notarization |
| `APPLE_PASSWORD` | App-specific password from [appleid.apple.com](https://appleid.apple.com) |
| `APPLE_TEAM_ID` | Team ID from Apple Developer → Membership |

4. Add the secrets to the Tauri build step in [`.github/workflows/release.yml`](.github/workflows/release.yml):

```yaml
env:
  APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
  APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
  APPLE_ID: ${{ secrets.APPLE_ID }}
  APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
  APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

5. Push a release tag — CI signs and notarizes automatically.

To test signed packaging locally, export the same env vars and run `npm run dist:tauri`.

### Build a bundle locally (optional)

To test packaging before pushing a tag:

```bash
npm run dist:tauri
```

Output lands in `src-tauri/target/release/bundle/` (e.g. `.dmg` on macOS). Local builds use ad-hoc signing unless Apple certificate env vars are set.

### Release command

Release automation lives in `scripts/sync-version.mjs` (invoked via `npm run sync-version`). There is no `.cursor/commands/release.md` in this repo; follow the steps above to bump, verify, commit, and tag. You still need to push the commit and tag yourself to trigger CI.
