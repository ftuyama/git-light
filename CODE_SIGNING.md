# Code signing

How Tauri release bundles are signed.

## Tauri (current CI)

`release.yml` builds native bundles per OS via `tauri-action` (`npm run dist:tauri` locally): `.dmg` on macOS, NSIS/`msi` on Windows, `.AppImage`/`.deb` on Linux.
macOS behavior — see `DEVELOPER.md` “macOS code signing”:

| CI secrets | Result |
|------------|--------|
| None | Ad-hoc signed DMG (first launch may need **Right-click → Open**) |
| Apple certificate only | Developer ID signed |
| Certificate + notarization secrets | Signed + notarized (opens normally) |

Secrets (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
`APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`) live in GitHub repo settings,
never in the tree. Tauri picks these env vars up automatically at build time.

## Release checklist

Before cutting a release:

1. CI already runs `tauri-action` (or `npm run dist:tauri`) per OS matrix (`release.yml`).
2. macOS: export `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, plus `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` for notarization.
3. Windows: EV cert via `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` for updater signatures (or keep NSIS unsigned while unsigned).
4. Linux: GPG detached signatures only if an update feed is added; `.deb`/`AppImage` need no store signing.
5. Keep `src-tauri/capabilities/default.json` minimal — every added permission widens the signed bundle's attack surface.

## Hardening notes

- Renderer has no Node access — git runs only in Rust via argv arrays (no shell interpolation).
- Git spawns use argv arrays; no shell interpolation.
- Never commit certificates, `.p12` files, or Apple IDs. Rotate `APPLE_PASSWORD` if it ever touches the tree or logs.
