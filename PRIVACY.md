# Privacy

Git Light is a local-first desktop app. No account, no telemetry, no analytics.

## Data stays on your machine

| Data | Where | Notes |
|------|-------|-------|
| Repository content | Your disk | Git Light shells out to your local `git` CLI; repos are never uploaded anywhere |
| Preferences (`git-light:preferences`) | localStorage | Theme, layout, tabs, sidebar/graph prefs |
| Recent repos (`recent-repos.json`) | App data dir | Path + last-opened timestamp |
| Branch favorites (`branch-favorites:{path}`) | App data dir (`favorites.json`) | Per-repo pinned branches |
| Avatar cache (`git-light:avatar-cache-v4`) | localStorage | Cached GitHub logins and failed avatar sources per author email |
| Avatar sync (`git-light:github-author-sync-v1`) | localStorage | Timestamp of the last GitHub commit scan per repository |

No login, no cloud sync, no crash reporting.

## Network requests (only these)

1. **GitHub author lookup** — for repositories whose remote points at `github.com`, the public commits API (`https://api.github.com/repos/{owner}/{repo}/commits`) is read once per repository per day (up to 5 pages) to map commit author emails to GitHub logins. Only the public repository path is sent; no emails or local data are included. Private repositories simply fail and fall back to Gravatar/initials.
2. **Avatar images** — `https://github.com/{login}.png` for resolved logins, and `https://gravatar.com/avatar/{hash}` for other emails, where `{hash}` is the local MD5 of the lowercased commit email. Only the hash leaves the device, never the email. Failed lookups are remembered per source and retried after a week.
3. **Update check** — compares the app version against the latest GitHub release tag (`RELEASES_LATEST_API_URL` in `src/lib/tauri/updateCheck.ts`). Manual via **Check for Updates…**, plus an automatic check on startup in packaged builds. No identifiers are sent; GitHub sees a plain HTTPS fetch like any browser visit to the releases page.

Turn off **Preferences → Appearance → Author avatars** to skip all of the above and show initials only.

## Permissions

Tauri frontend allowlist: `src-tauri/capabilities/default.json` (`core/store/dialog/opener/shell` defaults). The renderer has no Node access; file/process access happens only in Rust commands with argv arrays (no shell interpolation), and git paths are validated (`validate_repo` in Rust, `assertPathInsideRepo` in TS).
