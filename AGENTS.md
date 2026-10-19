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

## Architecture

- UI in `src/` (Vue 3, Pinia, Tailwind v4). Never calls Git directly.
- Shared contracts in `shared/git/` (`actions.ts`, `models.ts`) and `shared/app/metadata.ts` (reads `package.json` at build time).
- Tauri backend in `src-tauri/src/` (`main.rs` registers `#[tauri::command]`, `git.rs`, `log.rs`, `refs.rs`, `diff.rs`). Frontend calls via `src/lib/tauri/` (`invoke.ts`, `tauriGitService.ts`) with `@tauri-apps/api`.
- Tauri config: `src-tauri/tauri.conf.json` (`beforeDevCommand: npm run dev:tauri`, `frontendDist: ../dist`), `src-tauri/capabilities/default.json`, `src-tauri/build.rs` (`tauri-build`).

## Conventions

- New Tauri commands: `#[tauri::command]` in a dedicated module + register in `generate_handler!` in `main.rs` + typed wrapper in `src/lib/tauri/`. Never `Command::new` with interpolated strings in the frontend; argv arrays in Rust.
- Rust errors: return `Result<T, GitError>` (`git::GitError`), not a bare `String`, except UI helpers.
- Version: edit only `package.json`, then run `npm run sync-version`. Never edit `Cargo.toml`/`tauri.conf.json`/`docs/*/version` manually.
- Do not edit generated output: `src-tauri/gen/`, `src-tauri/target/`, `src-tauri/icons/`, `dist/`, `out/`, `node_modules/`.
- Rust tests in `#[cfg(test)]` in the same module; parser/git tests in `vitest` in the frontend.

## Docs

- `README.md` — features + install; `DEVELOPER.md` — build/dev/release; `ARCHITECTURE.md` — stack + processes; `docs/llms.txt` + `docs/llms-full.txt` — AI index (generated via `sync-version`, do not edit version manually).
