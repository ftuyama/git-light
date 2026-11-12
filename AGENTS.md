# Git Light — Tauri 2 + Vue 3 + TypeScript + Rust

Desktop Git client (Tauri 2). Version source of truth: `package.json`.

## Commands

Frontend (Node 20+):

- `npm run dev` — Tauri dev (`tauri dev` + `vite --port 1420`)
- `npm run dev:tauri` — Vite in Tauri mode only (no native window)
- `npm run typecheck` — `vue-tsc --noEmit`
- `npm run test` — `vitest run`
- `npm run sync-version` — syncs version to `package-lock.json`, `docs/`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`
- `npm run sync-version -- --check` — check only, writes nothing
- `npm run icons` — regenerate `src-tauri/icons/` from `docs/icon.svg` (source of truth) + `src-tauri/app-icon.json` manifest; never edit icon binaries by hand

Backend (Rust):

- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
- `cargo fmt --check` / `cargo fmt`
- `cargo test --manifest-path src-tauri/Cargo.toml`

Check before commit/release: `npm run typecheck`, `npm run test`, `cargo clippy`, `cargo fmt --check`, `npm run sync-version -- --check`.

## Worktrees

Parallel or long-running work happens in `worktrees/` at the repo root (gitignored). The root checkout stays on `main`; each worktree owns one branch.

- Create: `npm run wt:add -- <name> [--base <ref>] [--install]` → branch `<name>` checked out at `worktrees/<name>` (an existing branch with that name is checked out instead of recreated).
- List: `npm run wt:ls`. Remove: `npm run wt:rm -- <name> [--force] [--delete-branch]`. Clean stale metadata: `npm run wt:prune`.
- Work inside `worktrees/<name>` as a normal checkout: run `npm install` there. `node_modules` is not shared with the root checkout.
- Each worktree gets its own `src-tauri/target/`, so the first Rust build in a worktree is a full rebuild. Never point two worktrees at the same `CARGO_TARGET_DIR` at once.
- Only one `npm run dev` runs at a time (Vite is `strictPort` on `:1420`). For a second worktree, run the UI only: `VITE_USE_MOCK=true npx vite --port 1421`, or `npx tauri dev --config '{"build":{"devUrl":"http://localhost:1421"}}'` with `npm run dev:tauri -- --port 1421`.
- Moves between checkouts: when an agent session works in a worktree, move the session into it (`session_move`) so file paths resolve against that worktree.
- Never commit `worktrees/`; removal keeps the branch unless `--delete-branch` is passed.

## Architecture

- UI in `src/` (Vue 3, Pinia, Tailwind v4). Never calls Git directly.
- Shared contracts in `shared/git/` (`actions.ts`, `models.ts`) and `shared/app/metadata.ts` (reads `package.json` at build time).
- Tauri backend in `src-tauri/src/` (`main.rs` registers `#[tauri::command]`, `git.rs`, `log.rs`, `refs.rs`, `diff.rs`). Frontend calls via `src/lib/tauri/` (`invoke.ts`, `tauriGitService.ts`) with `@tauri-apps/api`.
- Tauri config: `src-tauri/tauri.conf.json` (`beforeDevCommand: npm run dev:tauri`, `frontendDist: ../dist`), `src-tauri/capabilities/default.json`, `src-tauri/build.rs` (`tauri-build`).

## Conventions

- New Tauri commands: `#[tauri::command]` in a dedicated module + register in `generate_handler!` in `main.rs` + typed wrapper in `src/lib/tauri/`. Never `Command::new` with interpolated strings in the frontend; argv arrays in Rust.
- Rust errors: return `Result<T, GitError>` (`git::GitError`), not a bare `String`, except UI helpers.
- Version: edit only `package.json`, then run `npm run sync-version`. Never edit `Cargo.toml`/`tauri.conf.json`/`docs/*/version` manually.
- Do not edit generated output: `src-tauri/gen/`, `src-tauri/target/`, `src-tauri/icons/`, `dist/`, `out/`, `node_modules/`, `worktrees/`.
- Rust tests in `#[cfg(test)]` in the same module; parser/git tests in `vitest` in the frontend.

## Docs

- `README.md` — features + install; `DEVELOPER.md` — build/dev/release; `ARCHITECTURE.md` — stack + processes; `docs/llms.txt` + `docs/llms-full.txt` — AI index (generated via `sync-version`, do not edit version manually).
