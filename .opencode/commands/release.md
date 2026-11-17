---
description: Bump version, verify, commit, and tag a release
---

# Release — version bump, commit & tag

Bump the semver in `package.json`, verify the tree, commit all pending changes, and create an annotated git tag.

## Phase 1 — Refresh screenshots (mandatory)

`docs/screenshot.png` is the hero image shared by `README.md` and the landing page; both also embed the gallery in `docs/screenshots/`. Regenerate **every** asset on each release:

1. Run the mock UI with the AwesomeShop repo so every capture is reproducible:

   ```bash
   VITE_USE_MOCK=true npx vite --port 1421 --strictPort
   ```

2. Open <http://localhost:1421> at **1440×900** and expand the left sidebar (`Expand left panel`).
3. Capture the five views and overwrite these exact paths:

   | File | View / actions |
   |------|----------------|
   | `docs/screenshot.png` | Main repository view — sidebar, commit graph, working tree, commit box |
   | `docs/screenshots/diff-viewer.png` | Click `docs/elliptical.ts` in the working tree — diff with hunks and stage actions |
   | `docs/screenshots/search.png` | Search (`Cmd/Ctrl+Shift+F`), type `payment`, press Enter, wait for file results |
   | `docs/screenshots/command-palette.png` | Command palette (`Cmd/Ctrl+K`) over the main view |
   | `docs/screenshots/settings.png` | Settings → Appearance, showing the palette grid |

   Do not add, rename or remove gallery files — `README.md` links these paths. Do not screenshot browser-only placeholders such as the terminal panel, which says it is available only in the desktop app.

4. If the visible UI changed, sync the `README.md` hero caption and gallery captions, plus the `hero.screenshotTitle`, `hero.screenshotAlt` and `gallery.*` keys in every `site/locales/*.json`, then run `npm run site:build`.

Run `/update-docs` first if other documentation is not yet synced with the codebase — the screenshots themselves are not optional.

## Input

- **`$ARGUMENTS`** (optional): bump type or explicit version.
  - `patch` (default) — `0.1.0` → `0.1.1`
  - `minor` — `0.1.0` → `0.2.0`
  - `major` — `0.1.0` → `1.0.0`
  - explicit semver — e.g. `0.2.0` (use as-is)
- If no argument, default to **patch**.

## Phase 2 — Bump version

1. Read the current version from `package.json`.
2. List existing git tags (`git tag -l 'v*'`) to avoid collisions.
3. Compute the new semver from `$ARGUMENTS` (default patch).
4. Update `"version"` in `package.json` only (source of truth).
5. Sync all other version markers from `package.json` via [`scripts/sync-version.mjs`](../../scripts/sync-version.mjs):

```bash
npm run sync-version
```

This updates:
- `package-lock.json` — top-level `"version"` and `"packages".""`
- `site/index.html` / `site/locales/*.json` — `{{version}}` tokens (hero badge and footer); `sync-version` rebuilds the generated pages
- `docs/llms.txt` — `**Version:**` line in Key facts
- `src-tauri/Cargo.toml` — `[package] version`
- `src-tauri/tauri.conf.json` — top-level `version`

The app reads `package.json` at build time via `shared/app/metadata.ts` — no other source files need manual version edits.

To verify without writing files:

```bash
npm run sync-version -- --check
```

## Phase 3 — Verify

Run before committing:

```bash
npm run typecheck
npm run test
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo fmt --check
npm run sync-version -- --check
```

Fix any failures before proceeding. Do not tag a broken tree.

## Phase 4 — Commit and tag

1. Review `git status` — the release commit must include **all** pending source, test, and doc changes, not just the files touched in this command.
2. Stage everything for the release:

```bash
git add -A
```

`git add -A` respects `.gitignore` (skips `out/`, `node_modules/`, etc.). Do **not** hand-pick only docs or version files.

3. Confirm the index with `git diff --cached --stat`. If nothing is staged, stop — do not create an empty commit.
4. Commit with:

```
Release vX.Y.Z

<1-3 sentence summary of what changed since last release>
```

Use a HEREDOC for the commit message. Run `git log` since the last `v*` tag (or since repo start if no tags) to draft the summary.

5. Create an annotated tag:

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

6. Run `git status` and `git log -1 --decorate` to confirm commit + tag. Working tree should be clean (or only contain intentionally ignored/untracked artifacts).

**Do not push** unless the user explicitly asks.

## Constraints

- Never skip pre-commit hooks (`--no-verify`).
- Never force-push or amend unless the user explicitly requests it.
- Never update git config.
- Stage all existing pending changes for the release commit.
- If a tag `vX.Y.Z` already exists, stop and ask the user how to proceed.

## Response checklist

- [ ] `docs/screenshot.png` and all four gallery assets in `docs/screenshots/` refreshed at 1440×900 (+ README captions and landing page alt/titlebar/gallery copy synced if UI changed)
- [ ] Version bumped in `package.json`
- [ ] `npm run sync-version` run (`package-lock.json`, `docs/llms.txt`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` match; `docs/` site regenerated)
- [ ] `npm run typecheck`, `npm run test`, `cargo clippy`, `cargo fmt --check` pass
- [ ] All pending changes staged (`git add -A`) and included in release commit
- [ ] Commit created with release message
- [ ] Annotated tag `vX.Y.Z` created
- [ ] Summary returned: old → new version, files changed, tag name, reminder to `git push && git push --tags` when ready
