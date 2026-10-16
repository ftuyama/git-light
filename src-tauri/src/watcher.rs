use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::time::Duration;

use notify::{RecommendedWatcher, RecursiveMode, Watcher as NotifyWatcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// Mirrors `RepoChangeEvent` in `shared/git/models.ts`.
#[derive(Debug, Clone, Serialize)]
pub struct ChangeEvent {
    pub path: String,
    pub scopes: Vec<String>,
}

fn is_ignored(path: &Path) -> bool {
    // Mirrors GIT_IGNORED + WORKTREE_IGNORED (substring match on components).
    let ignored = [
        ".git/objects",
        ".git/logs",
        ".git/hooks",
        "fsmonitor",
        ".git/info",
        ".git/",
        "node_modules",
        "/dist/",
        "/build/",
        ".next",
        "/target/",
        "/vendor/",
        "__pycache__",
        ".venv",
        ".turbo",
        ".cache",
        "/coverage/",
    ];
    let s = path.to_string_lossy().replace('\\', "/");
    ignored.iter().any(|pat| s.contains(pat))
}

/// Mirrors `scopesForPath` in `RepositoryWatcher.ts`.
pub fn scopes_for_path(repo_path: &str, file_path: &str) -> Vec<String> {
    let rel = pathdiff(repo_path, file_path);
    let s = |v: &[&str]| v.iter().map(|s| s.to_string()).collect();
    if rel.contains(".git/HEAD") || rel.contains(".git/index") || rel.contains(".git/refs") {
        return s(&["commits", "branches", "status"]);
    }
    if rel.contains("MERGE")
        || rel.contains("REBASE")
        || rel.contains("CHERRY_PICK")
        || rel.contains("REVERT")
    {
        return s(&["status", "branches", "commits"]);
    }
    s(&["status"])
}

/// Lexical relative path (no filesystem access), `/`-normalized.
fn pathdiff(repo_path: &str, file_path: &str) -> String {
    let norm = |p: &str| p.replace('\\', "/").trim_end_matches('/').to_string();
    let repo = norm(repo_path);
    let file = norm(file_path);
    match file.strip_prefix(&repo) {
        Some(rest) => rest.trim_start_matches('/').to_string(),
        None => file,
    }
}

struct Worker {
    stop_tx: mpsc::Sender<()>,
    thread: Option<std::thread::JoinHandle<()>>,
}

/// Watches the working tree + `.git` for out-of-band changes, debouncing to
/// scoped `git:changed` events (mirrors `RepositoryWatcher`: 150ms debounce).
#[derive(Default)]
pub struct RepoWatcher {
    worker: Option<Worker>,
}

impl RepoWatcher {
    pub fn watch(&mut self, app: &AppHandle, repo_path: &Path) {
        self.stop();
        let (event_tx, event_rx) = mpsc::channel::<Vec<PathBuf>>();
        let mut watcher: RecommendedWatcher =
            match notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
                if let Ok(event) = res {
                    let _ = event_tx.send(event.paths);
                }
            }) {
                Ok(w) => w,
                Err(_) => return,
            };
        if watcher.watch(repo_path, RecursiveMode::Recursive).is_err() {
            return;
        }
        // Keep the watcher alive on the worker thread.
        let (stop_tx, stop_rx) = mpsc::channel::<()>();
        let app = app.clone();
        let repo = repo_path.to_string_lossy().into_owned();
        let thread = std::thread::spawn(move || {
            let _watcher = watcher;
            let mut pending: Vec<String> = Vec::new();
            loop {
                match event_rx.recv_timeout(Duration::from_millis(150)) {
                    Ok(paths) => {
                        for p in paths {
                            if is_ignored(&p) {
                                continue;
                            }
                            for scope in scopes_for_path(&repo, &p.to_string_lossy()) {
                                if !pending.contains(&scope) {
                                    pending.push(scope);
                                }
                            }
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        if !pending.is_empty() {
                            let scopes = std::mem::take(&mut pending);
                            let _ = app.emit(
                                "git:changed",
                                ChangeEvent {
                                    path: repo.clone(),
                                    scopes,
                                },
                            );
                        }
                        if stop_rx.try_recv().is_ok() {
                            return;
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => return,
                }
                if stop_rx.try_recv().is_ok() {
                    return;
                }
            }
        });
        self.worker = Some(Worker {
            stop_tx,
            thread: Some(thread),
        });
    }

    pub fn stop(&mut self) {
        if let Some(mut worker) = self.worker.take() {
            let _ = worker.stop_tx.send(());
            if let Some(thread) = worker.thread.take() {
                let _ = thread.join();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn head_and_refs_trigger_graph_scopes() {
        assert_eq!(
            scopes_for_path("/repo", "/repo/.git/HEAD"),
            vec![
                "commits".to_string(),
                "branches".to_string(),
                "status".to_string()
            ]
        );
        assert_eq!(
            scopes_for_path("/repo", "/repo/.git/refs/heads/main"),
            vec![
                "commits".to_string(),
                "branches".to_string(),
                "status".to_string()
            ]
        );
    }

    #[test]
    fn merge_state_triggers_status_first() {
        assert_eq!(
            scopes_for_path("/repo", "/repo/.git/MERGE_HEAD"),
            vec![
                "status".to_string(),
                "branches".to_string(),
                "commits".to_string()
            ]
        );
    }

    #[test]
    fn other_git_files_and_worktree_files_map_to_status() {
        assert_eq!(
            scopes_for_path("/repo", "/repo/.git/COMMIT_EDITMSG"),
            vec!["status".to_string()]
        );
        assert_eq!(
            scopes_for_path("/repo", "/repo/src/a.ts"),
            vec!["status".to_string()]
        );
    }

    #[test]
    fn start_stop_is_safe_without_events() {
        let mut watcher = RepoWatcher::default();
        watcher.stop();
    }
}
