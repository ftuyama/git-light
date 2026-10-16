# Privacy

Git Light is a local-first desktop app. No account, no telemetry, no analytics.

## Data stays on your machine

| Data | Where | Notes |
|------|-------|-------|
| Repository content | Your disk | Git Light shells out to your local `git` CLI; repos are never uploaded anywhere |
| Preferences (`git-light:preferences`) | localStorage | Theme, layout, tabs, sidebar/graph prefs |
| Recent repos (`recent-repos.json`) | App data dir | Path + last-opened timestamp |
| Branch favorites (`branch-favorites:{path}`) | App data dir (`favorites.json`) | Per-repo pinned branches |
| Avatar cache (`git-light:avatar-cache-v3`) | localStorage | Cached author avatar URLs |

No login, no cloud sync, no crash reporting.

## Network requests (only these)

1. **Author avatars** — `https://github.com/{user}.png` for `*@users.noreply.github.com` emails only, with per-email failure backoff (`avatarCache.ts`). Gravatar-style lookup for other emails derives from the commit email hash; no email list leaves the device beyond the image request itself.
2. **Update check** — compares the app version against the latest GitHub release tag (`RELEASES_LATEST_API_URL` in `src/lib/tauri/updateCheck.ts`). Manual via **Check for Updates…**, plus an automatic check on startup in packaged builds. No identifiers are sent; GitHub sees a plain HTTPS fetch like any browser visit to the releases page.

## Permissions

Tauri frontend allowlist: `src-tauri/capabilities/default.json` (`core/store/dialog/opener/shell` defaults). The renderer has no Node access; file/process access happens only in Rust commands with argv arrays (no shell interpolation), and git paths are validated (`validate_repo` in Rust, `assertPathInsideRepo` in TS).
