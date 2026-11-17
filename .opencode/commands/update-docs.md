---
description: Sync docs and screenshots with the codebase
---

# Release docs — discover & update documentation

Bring repository documentation and marketing assets in line with the current codebase. Does **not** bump version, commit, or tag — use `/release` for that.

## Phase 1 — Discover current state

1. Read the current version from `package.json`.
2. List existing git tags (`git tag -l 'v*'`) for context.
3. Scan the codebase to understand what is actually shipped today:
   - `src/features/` — UI surfaces and capabilities
   - `src-tauri/src/` — Tauri backend git layer (`git.rs`, `log.rs`, `refs.rs`, `diff.rs`, `main.rs` commands)
   - `shared/git/` — contracts and actions
   - `src/lib/graph/` — graph layout and tests
   - `package.json` — dependency versions (Tauri, Vue, etc.)
4. Run `git status` to list unstaged and untracked files.
5. Run `git log` since the last `v*` tag (or since repo start if no tags) to capture what changed.

## Phase 2 — Update documentation

Update every doc file so it reflects the codebase **right now**. Do not invent features; verify each claim against source.

### Files to update

| File | What to sync |
|------|--------------|
| [README.md](README.md) | Hero blurb, feature list, "What works today" table, scripts table, quick-start notes; hero image path (`docs/screenshot.png`) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack versions, process diagram accuracy, file tables (`src-tauri/src/`, `src/lib/git/`, `src/lib/tauri/`, `shared/git/`), UI layout tree, test file list, extension points |
| [docs/index.html](docs/index.html) | Hero copy, feature cards, stack tags, install section, screenshot `alt` / titlebar label — GitHub Pages landing page |
| [docs/llms.txt](docs/llms.txt) | AI-readable site summary — features, links, install; version line synced by `npm run sync-version` |
| [docs/screenshot.png](docs/screenshot.png) + [docs/screenshots/](docs/screenshots/) | Fresh app screenshots (see below) — hero shared by README and the landing page; feature gallery embedded in README |

### Refresh screenshots

[README.md](README.md) embeds the hero `docs/screenshot.png` plus four gallery images in `docs/screenshots/`; [docs/index.html](docs/index.html) reuses the hero. Regenerate the full set whenever the UI has changed visually since the last release.

1. **Run the mock UI** with the AwesomeShop repo so every capture is reproducible:

   ```bash
   VITE_USE_MOCK=true npx vite --port 1421 --strictPort
   ```

2. **Open** <http://localhost:1421> at **1440×900** and expand the left sidebar (`Expand left panel`).
3. **Capture** these exact views:

   | File | View / actions |
   |------|----------------|
   | `docs/screenshot.png` | Main repository view — sidebar, commit graph, working tree, commit box |
   | `docs/screenshots/diff-viewer.png` | Click `docs/elliptical.ts` in the working tree — diff with hunks and stage actions |
   | `docs/screenshots/search.png` | Search (`Cmd/Ctrl+Shift+F`), type `payment`, press Enter, wait for file results |
   | `docs/screenshots/command-palette.png` | Command palette (`Cmd/Ctrl+K`) over the main view |
   | `docs/screenshots/settings.png` | Settings → Appearance, showing the palette grid |

   Mock mode serves deterministic diffs from `src/data/mockDiff.ts`. Skip browser-only placeholders such as the terminal panel, which says it is available only in the desktop app. Do not add, rename or remove gallery files — `README.md` links these paths.
4. **Sync copy** in `docs/index.html` if the visible UI changed:
   - `.screenshot-title` (window title in the faux titlebar)
   - `<img alt="…">` (describe what is on screen)
5. **README** — confirm the hero caption and the gallery image paths/captions still match what each screenshot shows.

Prefer a window screenshot over cropping browser chrome. If automated capture is unavailable, take manual screenshots and save them to the same paths.

### Documentation rules

- **Accuracy over marketing** — if the landing page says "mock backend" but real git works, fix it.
- **Keep tone and structure** — match existing style (tables in README, ASCII diagram in ARCHITECTURE, dark-theme HTML in docs).
- **Stack versions** — pull real versions from `package.json` dependencies (e.g. Tauri, Vue, Tailwind).
- **Feature inventory** — include settings menu, search overlay, operation banner, app preferences, etc. if they exist in `src/features/`.
- **Test list** — do not enumerate `*.test.ts` files in ARCHITECTURE.md; describe test locations and how to run them instead.
- **Do not** create new doc files unless a gap is critical (e.g. no CHANGELOG exists — skip unless user asks).
- **Do not** modify `index.html` at repo root (Vite app entry) or generated `dist/` files.

## Constraints

- Keep doc edits focused — no drive-by refactors while updating docs.
- Do **not** commit, bump version, or create tags unless the user explicitly asks.

## Response checklist

- [ ] Codebase scanned; docs reflect current features and stack
- [ ] README.md, ARCHITECTURE.md, docs/index.html, and docs/llms.txt updated
- [ ] `docs/screenshot.png` and all four `docs/screenshots/*.png` gallery assets refreshed; README captions and landing page alt/titlebar copy match
- [ ] Summary returned: files changed (including `docs/screenshot.png` if updated), reminder to run `/release` when ready to bump version and tag
