mod actions;
mod app;
mod app_updater;
mod diff;
mod git;
mod image;
mod log;
mod refs;
mod repos;
mod watcher;

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

use git::{GitError, RecentRepository, WireSnapshot};

struct AppState {
    current: Mutex<Option<PathBuf>>,
    journal: tokio::sync::Mutex<actions::Journal>,
    operations: tokio::sync::Mutex<actions::Operations>,
    watcher: std::sync::Mutex<watcher::RepoWatcher>,
    /// Canonical path -> validated repository info for this app run. Tab
    /// switches, snapshots and actions reuse it so `git rev-parse` only ever
    /// runs the first time a repository is touched.
    validated: Mutex<std::collections::HashMap<PathBuf, git::RepoInfo>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            current: Mutex::new(None),
            journal: tokio::sync::Mutex::new(actions::Journal::default()),
            operations: tokio::sync::Mutex::new(actions::Operations::default()),
            watcher: std::sync::Mutex::new(watcher::RepoWatcher::default()),
            validated: Mutex::new(std::collections::HashMap::new()),
        }
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    operation_id: String,
    kind: String,
    phase: String,
    percent: Option<u32>,
    done: bool,
}

/// Patch undo/redo affordances from the journal (mirrors the provider,
/// which derives them from `journal.getState` on every snapshot).
async fn apply_journal_state(state: &State<'_, AppState>, snap: &mut WireSnapshot) {
    let journal_state = {
        let journal = state.journal.lock().await;
        journal.state(&snap.repository.state)
    };
    snap.repository.can_undo = journal_state.can_undo;
    snap.repository.can_redo = journal_state.can_redo;
    snap.repository.undo_label = journal_state.undo_label;
    snap.repository.redo_label = journal_state.redo_label;
}

#[derive(Serialize)]
struct GitVersion {
    version: String,
}

#[derive(Serialize)]
struct OpenRepoEnvelope {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    snapshot: Option<WireSnapshot>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<GitError>,
}

impl OpenRepoEnvelope {
    fn ok(snapshot: WireSnapshot) -> Self {
        Self {
            ok: true,
            snapshot: Some(snapshot),
            error: None,
        }
    }

    fn err(error: GitError) -> Self {
        Self {
            ok: false,
            snapshot: None,
            error: Some(error),
        }
    }
}

#[tauri::command]
async fn git_version() -> Result<GitVersion, String> {
    let output = tokio::process::Command::new("git")
        .arg("--version")
        .stdin(std::process::Stdio::null())
        .output()
        .await
        .map_err(|e| format!("failed to spawn git: {e}"))?;
    if !output.status.success() {
        return Err("git --version failed".to_string());
    }
    Ok(GitVersion {
        version: String::from_utf8_lossy(&output.stdout).trim().to_string(),
    })
}

#[tauri::command]
fn ping(value: Option<String>) -> Option<String> {
    value
}

fn recents_file(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join("recent-repos.json"))
}

/// App-data JSON files are read from `async` commands (open/activate/snapshot),
/// so they go through `tokio::fs`: a synchronous read here would block a
/// runtime worker thread for the duration of the disk access.
async fn read_recents(app: &AppHandle) -> Vec<RecentRepository> {
    let Some(file) = recents_file(app) else {
        return Vec::new();
    };
    match tokio::fs::read_to_string(file).await {
        Ok(raw) => git::parse_recent_repos(&raw),
        Err(_) => Vec::new(),
    }
}

async fn write_recents(app: &AppHandle, list: &[RecentRepository]) {
    let Some(file) = recents_file(app) else {
        return;
    };
    let Ok(raw) = serde_json::to_string_pretty(list) else {
        return;
    };
    if let Some(parent) = file.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    let _ = tokio::fs::write(file, raw).await;
}

fn favorites_file(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join("favorites.json"))
}

/// See [`read_recents`]: same reasoning for the favorites file, which the
/// snapshot builder reads on every open, refresh and preload.
async fn read_favorites(app: &AppHandle) -> git::FavoritesMap {
    let Some(file) = favorites_file(app) else {
        return Default::default();
    };
    match tokio::fs::read_to_string(file).await {
        Ok(raw) => git::parse_favorites_file(&raw),
        Err(_) => Default::default(),
    }
}

async fn write_favorites(app: &AppHandle, map: &git::FavoritesMap) {
    let Some(file) = favorites_file(app) else {
        return;
    };
    let Ok(raw) = serde_json::to_string_pretty(map) else {
        return;
    };
    if let Some(parent) = file.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    let _ = tokio::fs::write(file, raw).await;
}

fn favorites_for(map: &git::FavoritesMap, repo_path: &str) -> std::collections::HashSet<String> {
    git::favorite_names(map, repo_path).into_iter().collect()
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct FavoritesFetchRequest {
    repo_path: String,
}

#[tauri::command]
async fn git_get_favorites(app: AppHandle, request: FavoritesFetchRequest) -> Vec<String> {
    git::favorite_names(&read_favorites(&app).await, &request.repo_path)
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SetFavoritesRequest {
    repo_path: String,
    names: Vec<String>,
}

#[tauri::command]
async fn git_set_favorites(app: AppHandle, request: SetFavoritesRequest) -> Vec<String> {
    let mut map = read_favorites(&app).await;
    git::set_favorite_names(&mut map, &request.repo_path, &request.names);
    write_favorites(&app, &map).await;
    request.names
}

fn set_current(state: &State<'_, AppState>, path: Option<PathBuf>) {
    if let Ok(mut current) = state.current.lock() {
        *current = path;
    }
}

/// Validated `RepoInfo` for `path`, cached per canonical path for the rest of
/// the run. Validation spawns git, so re-resolving a repository we already
/// opened (every tab switch, every snapshot, every action) would otherwise
/// cost a `rev-parse` round-trip each time.
async fn resolve_repo_info(
    state: &State<'_, AppState>,
    path: &Path,
) -> Result<git::RepoInfo, GitError> {
    let canonical = tokio::fs::canonicalize(path).await.map_err(|_| {
        GitError::new(
            "RepositoryNotFound",
            "The repository could not be found.".to_string(),
        )
    })?;
    if let Ok(cache) = state.validated.lock() {
        if let Some(info) = cache.get(&canonical) {
            return Ok(info.clone());
        }
    }
    let info = git::validate_repo(&canonical).await?;
    if let Ok(mut cache) = state.validated.lock() {
        // Keyed by both the path as given and the resolved work-tree root, so
        // opening a subfolder of a known repo is a cache hit next time too.
        cache.insert(canonical, info.clone());
        cache.insert(info.path.clone(), info.clone());
    }
    Ok(info)
}

fn snapshot_options_from(value: &Option<serde_json::Value>) -> git::SnapshotOptions {
    let get = |key: &str| value.as_ref().and_then(|v| v.get(key));
    let commit_limit = get("commitLimit")
        .and_then(|v| v.as_u64())
        .unwrap_or(100)
        .clamp(1, 5000) as usize;
    let graph_all = get("graphScope").and_then(|v| v.as_str()).unwrap_or("all") != "head";
    let want = |scope: &str| {
        get("scopes")
            .and_then(|v| v.as_array())
            .map(|scopes| scopes.iter().any(|s| s.as_str() == Some(scope)))
            .unwrap_or(true)
    };
    git::SnapshotOptions {
        commit_limit,
        graph_all,
        with_commits: want("commits"),
        with_branches: want("branches"),
        with_tags: want("tags"),
        with_stashes: want("stashes"),
        with_worktrees: want("worktrees"),
        with_status: want("status"),
    }
}

/// `GIT_LIGHT_PERF=1` (or any debug build) turns on phase timings for the
/// repository commands. They go to stderr, which *is* visible in the terminal
/// running `npm run dev` (the Tauri webview console is not piped there).
fn perf_enabled() -> bool {
    cfg!(debug_assertions) || matches!(std::env::var("GIT_LIGHT_PERF").as_deref(), Ok("1"))
}

fn perf_log(label: &str, start: std::time::Instant) {
    if perf_enabled() {
        eprintln!(
            "[git-light perf] {label}: {:.1}ms",
            start.elapsed().as_secs_f64() * 1000.0
        );
    }
}

/// Frontend perf samples (store phases, graph layout, ...) printed on the
/// terminal. The webview console is invisible during `tauri dev`, so this
/// bridge is how `[git-light perf]` lines from the app reach stderr.
#[tauri::command]
fn git_perf_log(label: String, ms: Option<f64>) {
    if !perf_enabled() {
        return;
    }
    match ms {
        Some(ms) => eprintln!("[git-light perf] {label}: {ms:.1}ms"),
        None => eprintln!("[git-light perf] {label}"),
    }
}

async fn do_open_repo(
    app: &AppHandle,
    state: &State<'_, AppState>,
    path: &str,
    options: &Option<serde_json::Value>,
) -> OpenRepoEnvelope {
    let started = std::time::Instant::now();
    let info = match resolve_repo_info(state, Path::new(path)).await {
        Ok(info) => info,
        Err(error) => return OpenRepoEnvelope::err(error),
    };
    perf_log("open: resolve_repo_info", started);
    let opts = snapshot_options_from(options);
    let repo_path = info.path.to_string_lossy().into_owned();
    let favorites = favorites_for(&read_favorites(app).await, &repo_path);
    let snapshot_at = std::time::Instant::now();
    let snapshot = git::build_snapshot_with_info(&info, &opts, &favorites).await;
    perf_log("open: build_snapshot", snapshot_at);
    match snapshot {
        Ok(mut snapshot) => {
            set_current(state, Some(info.path.clone()));
            state.journal.lock().await.clear();
            let watch_at = std::time::Instant::now();
            if let Ok(mut watcher) = state.watcher.lock() {
                watcher.watch(app, &info.path);
            }
            perf_log("open: watcher.watch", watch_at);
            apply_journal_state(state, &mut snapshot).await;
            let merged = git::merge_recent(read_recents(app).await, &repo_path, git::now_millis());
            write_recents(app, &merged).await;
            perf_log("open: total", started);
            OpenRepoEnvelope::ok(snapshot)
        }
        Err(error) => OpenRepoEnvelope::err(error),
    }
}

#[tauri::command]
async fn git_open_repo(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    options: Option<serde_json::Value>,
) -> Result<OpenRepoEnvelope, String> {
    Ok(do_open_repo(&app, &state, &path, &options).await)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ActivateRepoEnvelope {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<GitError>,
}

/// Re-points the backend's single open repository at `path` without rebuilding
/// a snapshot. The frontend calls this on every tab switch so the later IPCs
/// (`git_snapshot`, diffs, actions, watcher events) always run against the
/// repository that is on screen — without it, a switch to a cached tab leaves
/// `current` on the previous repo and its data leaks into the visible one.
async fn do_activate_repo(
    app: &AppHandle,
    state: &State<'_, AppState>,
    path: &str,
) -> Result<PathBuf, GitError> {
    let started = std::time::Instant::now();
    // Served from the validation cache when the repository was opened before,
    // which is the common case for a tab switch: no git process at all.
    let root = resolve_repo_info(state, Path::new(path))
        .await
        .map_err(|_| {
            GitError::new(
                "RepositoryNotFound",
                "The repository could not be found.".to_string(),
            )
        })?
        .path;
    perf_log("activate: resolve_repo_info", started);
    {
        let current = state
            .current
            .lock()
            .map_err(|_| GitError::unknown("Repository state is unavailable.".to_string()))?;
        if *current == Some(root.clone()) {
            return Ok(root);
        }
    }
    set_current(state, Some(root.clone()));
    state.journal.lock().await.clear();
    let watch_at = std::time::Instant::now();
    if let Ok(mut watcher) = state.watcher.lock() {
        watcher.watch(app, &root);
    }
    perf_log("activate: watcher.watch", watch_at);
    perf_log("activate: total", started);
    Ok(root)
}

#[tauri::command]
async fn git_activate_repo(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<ActivateRepoEnvelope, String> {
    match do_activate_repo(&app, &state, &path).await {
        Ok(canonical) => Ok(ActivateRepoEnvelope {
            ok: true,
            path: Some(canonical.to_string_lossy().into_owned()),
            error: None,
        }),
        Err(error) => Ok(ActivateRepoEnvelope {
            ok: false,
            path: None,
            error: Some(error),
        }),
    }
}

#[tauri::command]
async fn git_pick_and_open_repo(
    app: AppHandle,
    state: State<'_, AppState>,
    options: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    use tauri_plugin_dialog::FilePath;
    Ok(match app.dialog().file().blocking_pick_folder() {
        None => serde_json::json!({ "cancelled": true }),
        Some(picked) => {
            let path = match picked {
                FilePath::Path(p) => p.to_string_lossy().into_owned(),
                FilePath::Url(url) => url.to_string(),
            };
            let envelope = do_open_repo(&app, &state, &path, &options).await;
            serde_json::to_value(envelope).unwrap_or(serde_json::json!({ "ok": false }))
        }
    })
}

#[tauri::command]
async fn git_clone_repo(
    app: AppHandle,
    state: State<'_, AppState>,
    request: repos::CloneRepoRequest,
    options: Option<serde_json::Value>,
) -> Result<OpenRepoEnvelope, String> {
    let url = match repos::validate_clone_url(&request.url) {
        Ok(url) => url,
        Err(error) => return Ok(OpenRepoEnvelope::err(error)),
    };
    let parent = match tokio::fs::canonicalize(request.parent_path.trim()).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(OpenRepoEnvelope::err(GitError::unknown(
                "The destination folder could not be found.".to_string(),
            )))
        }
    };
    if !parent.is_dir() {
        return Ok(OpenRepoEnvelope::err(GitError::unknown(
            "The destination folder could not be found.".to_string(),
        )));
    }
    let raw_name = request.name.unwrap_or_default();
    let name = if raw_name.trim().is_empty() {
        repos::derive_repo_name(&url)
    } else {
        repos::sanitize_dir_name(raw_name.trim())
    };
    let dest = match repos::destination_for_clone(&parent, &name) {
        Ok(dest) => dest,
        Err(error) => return Ok(OpenRepoEnvelope::err(error)),
    };
    if dest.exists() {
        if !dest.is_dir() {
            return Ok(OpenRepoEnvelope::err(GitError::unknown(
                "The destination already exists.".to_string(),
            )));
        }
        match repos::is_dir_empty(&dest) {
            Ok(true) => {}
            _ => {
                return Ok(OpenRepoEnvelope::err(GitError::unknown(
                    "The destination folder is not empty.".to_string(),
                )))
            }
        }
    }
    let operation_id = uuid::Uuid::new_v4().to_string();
    let cancel_rx = state.operations.lock().await.register(&operation_id);
    let emit = |phase: &str, percent: Option<u32>, done: bool| {
        let payload = ProgressPayload {
            operation_id: operation_id.clone(),
            kind: "clone".to_string(),
            phase: phase.to_string(),
            percent,
            done,
        };
        let _ = app.emit("git:progress", payload);
    };
    emit("Cloning repository…", None, false);
    let args = vec![
        "clone".to_string(),
        url.clone(),
        dest.to_string_lossy().into_owned(),
    ];
    let result = actions::run_git_streaming(
        &parent,
        args,
        actions::RunOptions {
            timeout: Some(std::time::Duration::from_secs(300)),
            ..Default::default()
        },
        Some(cancel_rx),
        &|line| emit(line, None, false),
    )
    .await;
    state.operations.lock().await.unregister(&operation_id);
    emit("Clone finished.", None, true);
    if let Err(error) = result {
        return Ok(OpenRepoEnvelope::err(error));
    }
    Ok(do_open_repo(&app, &state, &dest.to_string_lossy(), &options).await)
}

#[tauri::command]
async fn git_init_repo(
    app: AppHandle,
    state: State<'_, AppState>,
    request: repos::InitRepoRequest,
    options: Option<serde_json::Value>,
) -> Result<OpenRepoEnvelope, String> {
    let canonical = match tokio::fs::canonicalize(request.path.trim()).await {
        Ok(p) => p,
        Err(_) => {
            return Ok(OpenRepoEnvelope::err(GitError::unknown(
                "The folder could not be found.".to_string(),
            )))
        }
    };
    if !canonical.is_dir() {
        return Ok(OpenRepoEnvelope::err(GitError::unknown(
            "The folder could not be found.".to_string(),
        )));
    }
    // Idempotent: a folder that is already a repo just opens.
    if resolve_repo_info(&state, &canonical).await.is_ok() {
        return Ok(do_open_repo(&app, &state, &canonical.to_string_lossy(), &options).await);
    }
    let branch = match repos::validate_init_branch(request.default_branch.as_deref()) {
        Ok(branch) => branch,
        Err(error) => return Ok(OpenRepoEnvelope::err(error)),
    };
    let mut argv: Vec<&str> = vec!["init"];
    if let Some(b) = branch.as_ref() {
        argv.push("-b");
        argv.push(b.as_str());
    }
    match git::git_text(&canonical, &argv).await {
        Ok((true, _, _)) => {}
        Ok((false, stdout, stderr)) => {
            let detail = if stderr.trim().is_empty() {
                stdout
            } else {
                stderr
            };
            return Ok(OpenRepoEnvelope::err(actions::classify_git_error(
                &detail,
                Some(1),
            )));
        }
        Err(error) => return Ok(OpenRepoEnvelope::err(error)),
    }
    Ok(do_open_repo(&app, &state, &canonical.to_string_lossy(), &options).await)
}

#[tauri::command]
async fn git_discover_repos(
    request: repos::DiscoverReposRequest,
) -> Result<Vec<repos::DiscoveredRepo>, String> {
    let root = match tokio::fs::canonicalize(request.root.trim()).await {
        Ok(p) => p,
        Err(_) => {
            return Err("The folder could not be found.".to_string());
        }
    };
    if !root.is_dir() {
        return Err("The folder could not be found.".to_string());
    }
    tokio::task::spawn_blocking(move || {
        repos::discover_repos(&root, request.max_depth.unwrap_or(2))
    })
    .await
    .map_err(|_| "The folder scan failed.".to_string())
}

#[tauri::command]
async fn git_close_repo(state: State<'_, AppState>) -> Result<(), String> {
    set_current(&state, None);
    state.journal.lock().await.clear();
    if let Ok(mut watcher) = state.watcher.lock() {
        watcher.stop();
    }
    Ok(())
}

/// Builds a snapshot for a repository that is *not* on screen, for background
/// tab preloading. Unlike `git_open_repo` this never touches `current`, the
/// journal, the watcher or the recents list, so a preload can never leave the
/// backend answering for a repository the user is not looking at.
async fn do_preload_repo(
    app: &AppHandle,
    state: &State<'_, AppState>,
    path: &str,
    options: &Option<serde_json::Value>,
) -> OpenRepoEnvelope {
    let started = std::time::Instant::now();
    let info = match resolve_repo_info(state, Path::new(path)).await {
        Ok(info) => info,
        Err(error) => return OpenRepoEnvelope::err(error),
    };
    let favorites = favorites_for(&read_favorites(app).await, &info.path.to_string_lossy());
    match git::build_snapshot_with_info(&info, &snapshot_options_from(options), &favorites).await {
        Ok(snapshot) => {
            perf_log("preload: total", started);
            OpenRepoEnvelope::ok(snapshot)
        }
        Err(error) => OpenRepoEnvelope::err(error),
    }
}

#[tauri::command]
async fn git_preload_repo(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    options: Option<serde_json::Value>,
) -> Result<OpenRepoEnvelope, String> {
    Ok(do_preload_repo(&app, &state, &path, &options).await)
}

#[tauri::command]
async fn git_snapshot(
    app: AppHandle,
    state: State<'_, AppState>,
    options: Option<serde_json::Value>,
) -> Result<WireSnapshot, GitError> {
    let current: Option<PathBuf> = state.current.lock().ok().and_then(|guard| guard.clone());
    match current {
        None => Err(GitError::unknown("No repository open.".to_string())),
        Some(path) => {
            let info = resolve_repo_info(&state, &path).await?;
            let repo_path = info.path.to_string_lossy().into_owned();
            let favorites = favorites_for(&read_favorites(&app).await, &repo_path);
            let mut snapshot =
                git::build_snapshot_with_info(&info, &snapshot_options_from(&options), &favorites)
                    .await?;
            apply_journal_state(&state, &mut snapshot).await;
            Ok(snapshot)
        }
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageRequest {
    before_sha: String,
    limit: Option<usize>,
    graph_scope: Option<String>,
    skip: Option<u32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PageResult {
    commits: Vec<git::WireCommit>,
    page: git::CommitPageInfo,
}

#[tauri::command]
async fn git_commit_page(
    state: State<'_, AppState>,
    request: PageRequest,
) -> Result<PageResult, GitError> {
    let current: Option<PathBuf> = state.current.lock().ok().and_then(|guard| guard.clone());
    let Some(path) = current else {
        return Err(GitError::unknown("No repository open.".to_string()));
    };
    let limit = request.limit.unwrap_or(100).clamp(1, 1000);
    let skip = request.skip.unwrap_or(0).min(1_000_000);
    let all = request.graph_scope.as_deref().unwrap_or("all") != "head";
    // `before_sha` comes from our own commit list: full/abbreviated hex SHA.
    // Validate before interpolating it into a rev spec.
    let before = request.before_sha.trim();
    if before.len() < 4 || before.len() > 64 || !before.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(GitError::unknown("Invalid revision.".to_string()));
    }
    // Mirrors `loadCommitsOlderThan`: `--all` walks from tips (use skip),
    // HEAD-scoped walks older than `beforeSha` (exclusive).
    let end_rev;
    let (end_rev_opt, skip) = if all {
        (None, skip)
    } else {
        end_rev = format!("{before}^");
        (Some(end_rev.as_str()), 0)
    };
    let bundle = log::fetch_commit_log(&path, limit, all, end_rev_opt, skip).await?;
    Ok(PageResult {
        commits: bundle.commits,
        page: git::CommitPageInfo {
            oldest_sha: bundle.oldest_sha,
            has_more: bundle.has_more,
            total: None,
        },
    })
}

#[tauri::command]
async fn git_cancel(state: State<'_, AppState>) -> Result<(), String> {
    state.operations.lock().await.cancel_all();
    Ok(())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ActionValue {
    kind: String,
    target: Option<String>,
    meta: Option<serde_json::Value>,
}

#[tauri::command]
async fn git_execute_action(
    app: AppHandle,
    state: State<'_, AppState>,
    action: ActionValue,
) -> Result<actions::ActionEnvelope, String> {
    let cwd = match state.current.lock().ok().and_then(|guard| guard.clone()) {
        Some(path) => path,
        None => {
            return Ok(actions::ActionEnvelope::err(GitError::unknown(
                "No repository open.".to_string(),
            )))
        }
    };
    if !cwd.exists() {
        return Ok(actions::ActionEnvelope::err(GitError::unknown(
            "The repository folder was deleted.".to_string(),
        )));
    }
    let git_dir = match resolve_repo_info(&state, &cwd).await {
        Ok(info) => info.git_dir,
        Err(error) => return Ok(actions::ActionEnvelope::err(error)),
    };
    let meta = action.meta.unwrap_or(serde_json::Value::Null);
    let operation_id = uuid::Uuid::new_v4().to_string();
    let operation_kind = action.kind.clone();
    let emit = |phase: &str, percent: Option<u32>, done: bool| {
        let payload = ProgressPayload {
            operation_id: operation_id.clone(),
            kind: operation_kind.clone(),
            phase: phase.to_string(),
            percent,
            done,
        };
        let _ = app.emit("git:progress", payload);
    };
    Ok(actions::execute_action(
        &operation_id,
        &cwd,
        &git_dir,
        &action.kind,
        action.target.as_deref(),
        &meta,
        &state.journal,
        &state.operations,
        &emit,
    )
    .await)
}

#[tauri::command]
async fn git_recent_repos(app: AppHandle) -> Vec<RecentRepository> {
    read_recents(&app).await
}

#[tauri::command]
async fn git_remove_recent(app: AppHandle, path: String) -> Vec<RecentRepository> {
    let list: Vec<RecentRepository> = read_recents(&app)
        .await
        .into_iter()
        .filter(|r| r.path != path)
        .collect();
    write_recents(&app, &list).await;
    list
}

#[tauri::command]
async fn git_reveal_path(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() || trimmed.contains('\0') {
        return Err("Could not reveal path.".to_string());
    }
    // Only reveal paths that exist: blocks probing and normalizes the value
    // passed to the file manager.
    let target = match tokio::fs::canonicalize(trimmed).await {
        Ok(p) => p,
        Err(_) => return Err("Could not reveal path.".to_string()),
    };
    let status = tokio::task::spawn_blocking(move || {
        if cfg!(target_os = "macos") {
            std::process::Command::new("open")
                .arg("-R")
                .arg(&target)
                .status()
        } else if cfg!(target_os = "windows") {
            std::process::Command::new("explorer")
                .arg(format!("/select,{}", target.to_string_lossy()))
                .status()
        } else {
            let dir = target
                .parent()
                .map(|p| p.as_os_str().to_owned())
                .unwrap_or_else(|| target.as_os_str().to_owned());
            std::process::Command::new("xdg-open").arg(dir).status()
        }
    })
    .await
    .map_err(|_| "Could not reveal path.".to_string())?;
    match status {
        Ok(s) if s.success() => Ok(()),
        _ => Err("Could not reveal path.".to_string()),
    }
}

/// Linux terminal emulators to probe, in preference order. The flag selects the
/// execute style: most take `-e`, modern gnome-terminal takes `--`.
// Only exercised on Linux production builds (and cross-platform unit tests).
#[allow(dead_code)]
const LINUX_TERMINAL_CANDIDATES: [(&str, bool); 5] = [
    ("x-terminal-emulator", true),
    ("gnome-terminal", false),
    ("konsole", true),
    ("xfce4-terminal", true),
    ("xterm", true),
];

/// First available emulator from [`LINUX_TERMINAL_CANDIDATES`].
#[allow(dead_code)]
fn pick_linux_terminal(available: &dyn Fn(&str) -> bool) -> Option<(&'static str, bool)> {
    LINUX_TERMINAL_CANDIDATES
        .iter()
        .copied()
        .find(|(name, _)| available(name))
}

/// `bash -lc` argv for the chosen emulator flag style.
#[allow(dead_code)]
fn linux_terminal_argv(program: &str, dash_e: bool, shell_cmd: &str) -> (String, Vec<String>) {
    let flag = if dash_e { "-e" } else { "--" };
    (
        program.to_string(),
        vec![
            flag.to_string(),
            "bash".to_string(),
            "-lc".to_string(),
            shell_cmd.to_string(),
        ],
    )
}

/// True when `name` resolves to an executable file on `PATH`.
/// Bare names only: anything with a separator or whitespace is rejected so
/// `TERM_PROGRAM` can never smuggle in a path or extra arguments.
#[allow(dead_code)]
fn executable_on_path(name: &str) -> bool {
    if name.is_empty() || name.contains(['/', '\\', ' ', '\t', '\0', '\n']) || name.starts_with('-')
    {
        return false;
    }
    let Some(paths) = std::env::var_os("PATH") else {
        return false;
    };
    std::env::split_paths(&paths).any(|dir| {
        let candidate = dir.join(name);
        if !candidate.is_file() {
            return false;
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::metadata(&candidate)
                .map(|m| m.permissions().mode() & 0o111 != 0)
                .unwrap_or(false)
        }
        #[cfg(not(unix))]
        {
            true
        }
    })
}

/// Validate an explicit working directory for the external terminal: it must
/// exist, be a directory, and contain no characters that could break out of
/// the quoting used per-platform below.
fn checked_terminal_cwd(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.contains(['\0', '\n', '\r', '"']) {
        return None;
    }
    let path = std::path::Path::new(trimmed);
    if !path.is_dir() {
        return None;
    }
    Some(trimmed.to_string())
}

/// Escape a directory for embedding in a double-quoted `bash -lc` fragment.
#[allow(dead_code)]
fn escape_for_bash_dq(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('`', "\\`")
        .replace('$', "\\$")
}

#[tauri::command]
async fn git_open_terminal_external(
    state: State<'_, AppState>,
    path: Option<String>,
) -> Result<serde_json::Value, String> {
    let cwd = match path {
        Some(p) => checked_terminal_cwd(&p),
        _ => state
            .current
            .lock()
            .ok()
            .and_then(|c| c.clone())
            .map(|p| p.to_string_lossy().into_owned()),
    };
    let Some(cwd) = cwd else {
        return Ok(serde_json::json!({ "ok": false }));
    };
    // Spawning blocks briefly; keep it off the async runtime.
    // The Linux emulator is resolved here so the blocking closure only spawns.
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let linux_target = {
        let shell_cmd = format!("cd \"{}\"; exec bash", escape_for_bash_dq(&cwd));
        // Explicit override first, otherwise probe PATH in preference order.
        // The override must be a bare executable name on PATH — never an
        // arbitrary path — so it cannot point at an attacker binary.
        match std::env::var("TERM_PROGRAM")
            .ok()
            .filter(|term| executable_on_path(term.trim()))
        {
            Some(term) => Some(linux_terminal_argv(term.trim(), true, &shell_cmd)),
            None => pick_linux_terminal(&|name| executable_on_path(name))
                .map(|(name, dash_e)| linux_terminal_argv(name, dash_e, &shell_cmd)),
        }
    };
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let Some((program, args)) = linux_target
    else {
        return Err("No terminal emulator found on PATH.".to_string());
    };
    let spawned = tokio::task::spawn_blocking(move || {
        #[cfg(target_os = "macos")]
        {
            // `open -a Terminal <dir>` opens a new window at the directory
            // without AppleScript string interpolation.
            std::process::Command::new("open")
                .args(["-a", "Terminal", &cwd])
                .spawn()
        }
        #[cfg(target_os = "windows")]
        {
            // `cwd` cannot contain `"` (checked above), so this stays one arg.
            std::process::Command::new("cmd.exe")
                .args(["/c", "start", "cmd.exe", "/K", &format!("cd /d \"{cwd}\"")])
                .spawn()
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            std::process::Command::new(program).args(args).spawn()
        }
    })
    .await
    .map_err(|_| "Could not open terminal.".to_string())?;
    match spawned {
        Ok(_) => Ok(serde_json::json!({ "ok": true })),
        Err(_) => Ok(serde_json::json!({ "ok": false })),
    }
}

fn current_repo(state: &State<'_, AppState>) -> Result<PathBuf, GitError> {
    state
        .current
        .lock()
        .ok()
        .and_then(|guard| guard.clone())
        .ok_or_else(|| GitError::unknown("No repository open.".to_string()))
}

fn parse_diff_source(source: &str) -> Result<diff::DiffSource, GitError> {
    match source {
        "worktree" => Ok(diff::DiffSource::Worktree),
        "index" => Ok(diff::DiffSource::Index),
        "commit" => Ok(diff::DiffSource::Commit),
        "range" => Ok(diff::DiffSource::Range),
        other => Err(GitError::unknown(format!(
            "Unknown diff source \"{other}\"."
        ))),
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiffFetchRequest {
    path: String,
    source: String,
    sha: Option<String>,
    to_sha: Option<String>,
    ignore_whitespace: Option<bool>,
}

#[tauri::command]
async fn git_get_diff(
    state: State<'_, AppState>,
    request: DiffFetchRequest,
) -> Result<git::DiffResult, GitError> {
    let cwd = current_repo(&state)?;
    diff::fetch_diff(
        &cwd,
        &diff::DiffFetch {
            source: parse_diff_source(&request.source)?,
            path: request.path,
            sha: request.sha,
            to_sha: request.to_sha,
            ignore_whitespace: request.ignore_whitespace.unwrap_or(false),
        },
    )
    .await
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImagePreviewFetchRequest {
    path: String,
    source: String,
    sha: Option<String>,
    to_sha: Option<String>,
}

#[tauri::command]
async fn git_get_image_preview(
    state: State<'_, AppState>,
    request: ImagePreviewFetchRequest,
) -> Result<image::ImagePreviewResult, GitError> {
    let cwd = current_repo(&state)?;
    image::fetch_image_preview(
        &cwd,
        &image::ImageFetch {
            source: parse_diff_source(&request.source)?,
            path: request.path,
            sha: request.sha,
            to_sha: request.to_sha,
        },
    )
    .await
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct BlameFetchRequest {
    path: String,
    source: String,
    sha: Option<String>,
    to_sha: Option<String>,
}

#[tauri::command]
async fn git_get_blame(
    state: State<'_, AppState>,
    request: BlameFetchRequest,
) -> Result<git::BlameResult, GitError> {
    let cwd = current_repo(&state)?;
    diff::fetch_blame(
        &cwd,
        &parse_diff_source(&request.source)?,
        &request.path,
        request.sha.as_deref(),
        request.to_sha.as_deref(),
    )
    .await
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileHistoryFetchRequest {
    path: String,
    limit: Option<usize>,
}

#[tauri::command]
async fn git_get_file_history(
    state: State<'_, AppState>,
    request: FileHistoryFetchRequest,
) -> Result<git::FileHistoryResult, GitError> {
    let cwd = current_repo(&state)?;
    diff::fetch_file_history(&cwd, &request.path, request.limit.unwrap_or(50)).await
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConflictFetchRequest {
    path: String,
}

#[tauri::command]
async fn git_get_conflict(
    state: State<'_, AppState>,
    request: ConflictFetchRequest,
) -> Result<git::ConflictResult, GitError> {
    let cwd = current_repo(&state)?;
    diff::fetch_conflict(&cwd, &request.path).await
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommitFilesFetchRequest {
    sha: String,
}

#[tauri::command]
async fn git_get_commit_files(
    state: State<'_, AppState>,
    request: CommitFilesFetchRequest,
) -> Result<Vec<git::WireWorkingTreeFile>, GitError> {
    let cwd = current_repo(&state)?;
    diff::fetch_commit_files(&cwd, &request.sha).await
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompareFetchRequest {
    from_sha: String,
    to_sha: String,
}

#[tauri::command]
async fn git_get_compare_files(
    state: State<'_, AppState>,
    request: CompareFetchRequest,
) -> Result<Vec<git::WireWorkingTreeFile>, GitError> {
    let cwd = current_repo(&state)?;
    diff::fetch_compare_files(&cwd, &request.from_sha, &request.to_sha).await
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchFetchRequest {
    text: String,
    fields: Option<Vec<String>>,
    #[serde(default)]
    regex: bool,
    limit: Option<usize>,
    graph_scope: Option<String>,
}

#[tauri::command]
async fn git_search(
    state: State<'_, AppState>,
    request: SearchFetchRequest,
) -> Result<git::SearchResults, GitError> {
    let cwd = current_repo(&state)?;
    diff::fetch_search(
        &cwd,
        &diff::SearchFetch {
            text: request.text,
            regex: request.regex,
            limit: request.limit.unwrap_or(50),
            graph_all: request.graph_scope.as_deref().unwrap_or("all") != "head",
            author_field: request
                .fields
                .map(|f| f.iter().any(|s| s == "author"))
                .unwrap_or(false),
        },
    )
    .await
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RebaseCommitsFetchRequest {
    base: String,
}

#[tauri::command]
async fn git_get_rebase_commits(
    state: State<'_, AppState>,
    request: RebaseCommitsFetchRequest,
) -> Result<git::RebaseCommitsResult, GitError> {
    let cwd = current_repo(&state)?;
    diff::fetch_rebase_commits(&cwd, &request.base).await
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            git_version,
            ping,
            git_open_repo,
            git_activate_repo,
            git_pick_and_open_repo,
            git_clone_repo,
            git_init_repo,
            git_discover_repos,
            git_close_repo,
            git_preload_repo,
            git_snapshot,
            git_commit_page,
            git_cancel,
            git_perf_log,
            git_recent_repos,
            git_remove_recent,
            git_reveal_path,
            git_open_terminal_external,
            git_get_diff,
            git_get_image_preview,
            git_get_blame,
            git_get_file_history,
            git_get_conflict,
            git_get_commit_files,
            git_get_compare_files,
            git_search,
            git_get_rebase_commits,
            git_execute_action,
            git_get_favorites,
            git_set_favorites,
            app_updater::app_self_update,
            app::app_relaunch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ping_echoes_value() {
        assert_eq!(ping(Some("pong".to_string())), Some("pong".to_string()));
        assert_eq!(ping(None), None);
    }

    #[tokio::test]
    async fn git_version_reports_git() {
        let version = git_version().await.expect("git must be installed").version;
        assert!(version.starts_with("git version"), "unexpected: {version}");
    }

    #[test]
    fn linux_terminal_prefers_first_available_emulator() {
        let picked = pick_linux_terminal(&|name| name == "konsole");
        assert_eq!(picked, Some(("konsole", true)));
        assert_eq!(pick_linux_terminal(&|_| false), None);
    }

    #[test]
    fn linux_terminal_argv_matches_emulator_flag_style() {
        let (program, args) = linux_terminal_argv("gnome-terminal", false, "cd \"/r\"; exec bash");
        assert_eq!(program, "gnome-terminal");
        assert_eq!(args, vec!["--", "bash", "-lc", "cd \"/r\"; exec bash"]);
        let (program, args) = linux_terminal_argv("konsole", true, "cd \"/r\"; exec bash");
        assert_eq!(program, "konsole");
        assert_eq!(args[0], "-e");
    }
}
