use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use serde::Serialize;
use tokio::sync::watch;

use crate::git::{child_env, git_text, GitError, RepoState};
use crate::refs::read_repo_state;

/// Mirrors `classifyGitError` in `shared/git/errors.ts`: first non-empty
/// stderr line becomes the message, keywords pick the code.
pub fn classify_git_error(stderr: &str, exit_code: Option<i32>) -> GitError {
    let text = stderr.trim();
    let lower = text.to_lowercase();
    let first_line = text
        .lines()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .unwrap_or("");
    let detail = if first_line.is_empty() {
        None
    } else {
        Some(first_line.to_string())
    };
    let make = |code: &str| {
        let message = if first_line.is_empty() {
            "An unexpected Git error occurred.".to_string()
        } else {
            first_line.to_string()
        };
        GitError::classified(code, message, detail.clone(), None)
    };
    if lower.contains("could not read username")
        || lower.contains("authentication failed")
        || lower.contains("permission denied (publickey)")
        || lower.contains("host key verification failed")
    {
        return make("Authentication");
    }
    if lower.contains("conflict")
        && (lower.contains("merge")
            || lower.contains("automatic")
            || lower.contains("cherry-pick")
            || lower.contains("rebase"))
    {
        let mut err = make("MergeConflict");
        err.files = Some(extract_conflict_files(text));
        return err;
    }
    if lower.contains("nothing to commit") || lower.contains("no changes added to commit") {
        return make("NothingToCommit");
    }
    if lower.contains("rejected") && lower.contains("non-fast-forward") {
        return make("RemoteRejected");
    }
    if lower.contains("failed to push") {
        return make("RemoteRejected");
    }
    if lower.contains("could not resolve host")
        || lower.contains("connection timed out")
        || lower.contains("network is unreachable")
    {
        return make("Network");
    }
    if lower.contains("would be overwritten")
        || lower.contains("your local changes")
        || lower.contains("please commit your changes or stash")
    {
        return make("DirtyWorktree");
    }
    if lower.contains("not a git repository") {
        return make("NotARepository");
    }
    let mut err = if first_line.is_empty() {
        GitError::unknown("An unexpected Git error occurred.".to_string())
    } else {
        GitError::unknown(first_line.to_string())
    };
    err.detail = exit_code.map(|c| format!("git exited with code {c}"));
    err
}

fn extract_conflict_files(text: &str) -> Vec<String> {
    let mut files = Vec::new();
    for line in text.lines() {
        // `CONFLICT (content): Merge conflict in <path>` / `Auto-merging <path>`
        if let Some(rest) = line.strip_prefix("CONFLICT") {
            if let Some(idx) = rest.find("Merge conflict in ") {
                files.push(rest[idx + "Merge conflict in ".len()..].trim().to_string());
            }
        } else if let Some(rest) = line.strip_prefix("Auto-merging ") {
            files.push(rest.trim().to_string());
        }
    }
    files
}

pub struct RunResult {
    pub stdout: String,
    /// Retained for progress plumbing + error classification parity with TS.
    #[allow(dead_code)]
    pub stderr: String,
    pub exit_code: Option<i32>,
}

pub struct RunOptions {
    pub allow_failure: bool,
    pub timeout: Option<Duration>,
    pub input: Option<String>,
    pub extra_env: Vec<(String, String)>,
}

impl Default for RunOptions {
    fn default() -> Self {
        Self {
            allow_failure: false,
            timeout: Some(Duration::from_secs(30)),
            input: None,
            extra_env: Vec::new(),
        }
    }
}

/// Registry of in-flight operations for `git_cancel` (mirrors the
/// `operations` map + AbortControllers in `GitProvider`).
/// Dropping a sender closes the channel, which the runner treats as cancel.
#[derive(Default)]
pub struct Operations {
    senders: HashMap<String, watch::Sender<()>>,
}

impl Operations {
    pub fn register(&mut self, id: &str) -> watch::Receiver<()> {
        let (tx, rx) = watch::channel(());
        self.senders.insert(id.to_string(), tx);
        rx
    }

    pub fn unregister(&mut self, id: &str) {
        self.senders.remove(id);
    }

    /// Cancel everything in flight; returns how many were still registered.
    /// Dropping the senders closes the channels, which runners treat as cancel.
    pub fn cancel_all(&mut self) -> usize {
        let n = self.senders.len();
        self.senders.clear();
        n
    }
}

fn base_argv(args: &[String]) -> Vec<String> {
    let mut full = vec![
        "-c".to_string(),
        "core.quotepath=false".to_string(),
        "-c".to_string(),
        "color.ui=false".to_string(),
    ];
    full.extend(args.iter().cloned());
    full
}

/// Throwing invocation (mirrors `gitCli.run`): non-zero exit without
/// `allow_failure` becomes a classified `GitError`; cancel/timeout kill.
pub async fn run_git(
    cwd: &Path,
    args: Vec<String>,
    mut opts: RunOptions,
    cancel: Option<watch::Receiver<()>>,
    on_progress_line: Option<&(dyn Fn(&str) + Send + Sync)>,
) -> Result<RunResult, GitError> {
    let full = base_argv(&args);
    let mut cmd = tokio::process::Command::new("git");
    cmd.args(&full)
        .current_dir(cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    child_env(&mut cmd);
    for (k, v) in std::mem::take(&mut opts.extra_env) {
        cmd.env(k, v);
    }
    let mut child = cmd
        .spawn()
        .map_err(|e| GitError::unknown(format!("failed to spawn git: {e}")))?;

    if let Some(input) = opts.input {
        use tokio::io::AsyncWriteExt;
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(input.as_bytes()).await;
        }
    }

    enum WaitEnd {
        Exited(Option<i32>),
        Cancelled,
        TimedOut,
    }
    // Drain pipes concurrently so large outputs never deadlock the child.
    // (`wait_with_output` consumes the child, but cancel/timeout must still
    // be able to kill it, so pipes are drained by background tasks.)
    let stdout_take = child.stdout.take();
    let stderr_take = child.stderr.take();
    let out_handle = tokio::spawn(async move {
        use tokio::io::AsyncReadExt;
        let mut buf = Vec::new();
        if let Some(pipe) = stdout_take {
            // Bounded read: stop once the cap is reached instead of
            // buffering an unbounded `git log/diff/status`.
            let mut limited = pipe.take((MAX_OUTPUT_BYTES + 1) as u64);
            let _ = limited.read_to_end(&mut buf).await;
        }
        truncate_output(buf)
    });
    let err_handle = tokio::spawn(async move {
        use tokio::io::AsyncReadExt;
        let mut buf = Vec::new();
        if let Some(pipe) = stderr_take {
            let mut limited = pipe.take((MAX_OUTPUT_BYTES + 1) as u64);
            let _ = limited.read_to_end(&mut buf).await;
        }
        truncate_output(buf)
    });
    let timeout = opts.timeout;
    let wait_end = async {
        tokio::select! {
            st = child.wait() => WaitEnd::Exited(st.ok().and_then(|s| s.code())),
            _ = async {
                match cancel {
                    Some(mut rx) => {
                        let _ = rx.changed().await;
                    }
                    None => std::future::pending::<()>().await,
                }
            } => WaitEnd::Cancelled,
            _ = async {
                match timeout {
                    Some(d) => tokio::time::sleep(d).await,
                    None => std::future::pending::<()>().await,
                }
            } => WaitEnd::TimedOut,
        }
    }
    .await;

    let killed = match wait_end {
        WaitEnd::Cancelled | WaitEnd::TimedOut => {
            let _ = child.start_kill();
            let _ = child.wait().await;
            true
        }
        WaitEnd::Exited(_) => false,
    };
    let stdout = String::from_utf8_lossy(&out_handle.await.unwrap_or_default()).into_owned();
    let stderr = String::from_utf8_lossy(&err_handle.await.unwrap_or_default()).into_owned();

    if killed {
        return Err(if matches!(wait_end, WaitEnd::TimedOut) {
            GitError::unknown("Git command timed out.".to_string())
        } else {
            GitError::new("Cancelled", "The operation was cancelled.".to_string())
        });
    }
    let exit_code = match wait_end {
        WaitEnd::Exited(code) => code,
        _ => None,
    };
    {
        let ok = exit_code == Some(0);

        if let Some(cb) = on_progress_line {
            for line in stderr.split(['\n', '\r']) {
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    cb(trimmed);
                }
            }
        }

        if ok || opts.allow_failure {
            return Ok(RunResult {
                stdout,
                stderr,
                exit_code,
            });
        }
        Err(classify_git_error(
            &stderr_or_stdout(&stderr, &stdout),
            exit_code,
        ))
    }
}

fn stderr_or_stdout(stderr: &str, stdout: &str) -> String {
    if stderr.trim().is_empty() {
        stdout.to_string()
    } else {
        stderr.to_string()
    }
}

/// Streaming invocation for remote ops; progress lines go to the callback
/// (mirrors `runStreaming`, incl. auto `--progress`).
pub async fn run_git_streaming(
    cwd: &Path,
    args: Vec<String>,
    opts: RunOptions,
    cancel: Option<watch::Receiver<()>>,
    on_line: &(dyn Fn(&str) + Send + Sync),
) -> Result<RunResult, GitError> {
    let supports_progress = matches!(
        args.first().map(String::as_str),
        Some("fetch" | "push" | "pull" | "clone")
    );
    let mut args = args.to_vec();
    if supports_progress
        && !args
            .iter()
            .any(|a| a == "--progress" || a == "--no-progress")
    {
        args.push("--progress".to_string());
    }
    run_git(cwd, args, opts, cancel, Some(on_line)).await
}

/// Buffered read-only helper that resolves instead of throwing
/// (for `allowFailure`-style probes).
pub async fn probe(cwd: &Path, args: &[&str]) -> (bool, String) {
    match git_text(cwd, args).await {
        Ok((ok, stdout, _)) => (ok, stdout),
        Err(_) => (false, String::new()),
    }
}

// ---------------- journal ----------------

#[derive(Debug, Clone, PartialEq)]
pub enum JournalCapture {
    Head,
    Index,
}

#[derive(Debug, Clone)]
pub struct Checkpoint {
    pub head_sha: String,
    pub branch: String,
    pub index_tree_sha: Option<String>,
    pub reset_mode: Option<String>,
}

#[derive(Debug, Clone)]
pub struct JournalEntry {
    pub checkpoint: Checkpoint,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalState {
    pub can_undo: bool,
    pub can_redo: bool,
    pub undo_label: Option<String>,
    pub redo_label: Option<String>,
}

#[derive(Debug, Default)]
pub struct Journal {
    undo_stack: Vec<JournalEntry>,
    redo_stack: Vec<JournalEntry>,
}

impl Journal {
    pub fn clear(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }

    pub fn state(&self, repo_state: &RepoState) -> JournalState {
        let safe = is_undo_redo_safe(repo_state);
        JournalState {
            can_undo: safe && !self.undo_stack.is_empty(),
            can_redo: safe && !self.redo_stack.is_empty(),
            undo_label: safe
                .then(|| self.undo_stack.last().map(|e| e.label.clone()))
                .flatten(),
            redo_label: safe
                .then(|| self.redo_stack.last().map(|e| e.label.clone()))
                .flatten(),
        }
    }

    pub fn push_undo(&mut self, checkpoint: Checkpoint, label: String) {
        self.undo_stack.push(JournalEntry { checkpoint, label });
        self.redo_stack.clear();
    }

    pub async fn capture(
        &self,
        cwd: &Path,
        capture: &JournalCapture,
    ) -> Result<Checkpoint, GitError> {
        let (head_ok, head_out) = probe(cwd, &["rev-parse", "HEAD"]).await;
        let (_, branch_out) = probe(cwd, &["rev-parse", "--abbrev-ref", "HEAD"]).await;
        let head_sha = head_out.trim().to_string();
        if !head_ok || head_sha.is_empty() {
            return Err(GitError::unknown("Could not read HEAD.".to_string()));
        }
        let mut index_tree_sha = None;
        if *capture == JournalCapture::Index {
            let (_, tree_out) = probe(cwd, &["write-tree"]).await;
            let tree = tree_out.trim().to_string();
            if !tree.is_empty() {
                index_tree_sha = Some(tree);
            }
        }
        Ok(Checkpoint {
            head_sha,
            branch: {
                let b = branch_out.trim().to_string();
                if b.is_empty() {
                    "HEAD".to_string()
                } else {
                    b
                }
            },
            index_tree_sha,
            reset_mode: None,
        })
    }

    pub async fn undo(&mut self, cwd: &Path) -> Result<String, GitError> {
        let entry = self
            .undo_stack
            .pop()
            .ok_or_else(|| GitError::unknown("Nothing to undo.".to_string()))?;
        let current = self
            .capture(
                cwd,
                &if entry.checkpoint.index_tree_sha.is_some() {
                    JournalCapture::Index
                } else {
                    JournalCapture::Head
                },
            )
            .await?;
        self.redo_stack.push(JournalEntry {
            checkpoint: current,
            label: entry.label.clone(),
        });
        restore(cwd, &entry.checkpoint).await?;
        Ok(format!("Undid {}", entry.label))
    }

    pub async fn redo(&mut self, cwd: &Path) -> Result<String, GitError> {
        let entry = self
            .redo_stack
            .pop()
            .ok_or_else(|| GitError::unknown("Nothing to redo.".to_string()))?;
        let current = self
            .capture(
                cwd,
                &if entry.checkpoint.index_tree_sha.is_some() {
                    JournalCapture::Index
                } else {
                    JournalCapture::Head
                },
            )
            .await?;
        self.undo_stack.push(JournalEntry {
            checkpoint: current,
            label: entry.label.clone(),
        });
        restore(cwd, &entry.checkpoint).await?;
        Ok(format!("Redid {}", entry.label))
    }
}

async fn current_head(cwd: &Path) -> Result<String, GitError> {
    let (ok, stdout) = probe(cwd, &["rev-parse", "HEAD"]).await;
    if !ok {
        return Err(GitError::unknown("Could not read HEAD.".to_string()));
    }
    Ok(stdout.trim().to_string())
}

async fn restore(cwd: &Path, entry: &Checkpoint) -> Result<(), GitError> {
    let opts = RunOptions::default();
    if entry.index_tree_sha.is_some() && entry.head_sha == current_head(cwd).await? {
        run_git(
            cwd,
            vec!["read-tree".into(), entry.index_tree_sha.clone().unwrap()],
            opts,
            None,
            None,
        )
        .await?;
        return Ok(());
    }
    let reset_flag = match entry.reset_mode.as_deref() {
        Some("soft") => "--soft",
        Some("mixed") => "--mixed",
        _ => "--hard",
    };
    if !entry.branch.is_empty() && entry.branch != "HEAD" {
        let checkout = run_git(
            cwd,
            vec!["checkout".into(), entry.branch.clone()],
            RunOptions {
                allow_failure: true,
                ..RunOptions::default()
            },
            None,
            None,
        )
        .await?;
        if checkout.exit_code == Some(0) {
            run_git(
                cwd,
                vec!["reset".into(), reset_flag.into(), entry.head_sha.clone()],
                RunOptions::default(),
                None,
                None,
            )
            .await?;
            if entry.index_tree_sha.is_some() && reset_flag == "--hard" {
                run_git(
                    cwd,
                    vec!["read-tree".into(), entry.index_tree_sha.clone().unwrap()],
                    RunOptions::default(),
                    None,
                    None,
                )
                .await?;
            }
            return Ok(());
        }
    }
    run_git(
        cwd,
        vec!["checkout".into(), "--detach".into(), entry.head_sha.clone()],
        RunOptions::default(),
        None,
        None,
    )
    .await?;
    if let Some(tree) = &entry.index_tree_sha {
        run_git(
            cwd,
            vec!["read-tree".into(), tree.clone()],
            RunOptions::default(),
            None,
            None,
        )
        .await?;
    }
    Ok(())
}

pub fn is_undo_redo_safe(state: &RepoState) -> bool {
    !state.merging
        && !state.rebasing
        && !state.cherry_picking
        && !state.reverting
        && !state.bisecting
}

/// Mirrors `journalCaptureFor` in `shared/git/undoPolicy.ts`.
pub fn journal_capture_for(kind: &str) -> Option<JournalCapture> {
    match kind {
        "commit"
        | "amend"
        | "commit-and-push"
        | "commit-and-force-push"
        | "merge"
        | "merge-continue"
        | "rebase"
        | "rebase-from-here"
        | "interactive-rebase"
        | "rebase-continue"
        | "cherry-pick"
        | "cherry-pick-continue"
        | "revert"
        | "revert-continue"
        | "reset-soft"
        | "reset-mixed"
        | "reset-hard"
        | "checkout"
        | "checkout-commit"
        | "checkout-tag"
        | "create-branch"
        | "pop-stash"
        | "apply-stash" => Some(JournalCapture::Head),
        "stash"
        | "stage"
        | "unstage"
        | "stage-all"
        | "unstage-all"
        | "stage-patch"
        | "unstage-patch"
        | "resolve-conflict-ours"
        | "resolve-conflict-theirs"
        | "resolve-conflict-block"
        | "mark-conflict-resolved" => Some(JournalCapture::Index),
        _ => None,
    }
}

pub fn is_journalable_action(kind: &str) -> bool {
    journal_capture_for(kind).is_some()
}

/// Mirrors `journalLabel` in `shared/git/undoPolicy.ts`.
pub fn journal_label(kind: &str, target: Option<&str>, meta_name: Option<&str>) -> String {
    match kind {
        "commit" => "Commit".to_string(),
        "amend" => "Amend commit".to_string(),
        "commit-and-push" => "Commit and push".to_string(),
        "commit-and-force-push" => "Commit and force push".to_string(),
        "merge" | "merge-continue" => match target {
            Some(t) if !t.is_empty() => format!("Merge {t}"),
            _ => "Merge".to_string(),
        },
        "rebase" | "rebase-continue" => match target {
            Some(t) if !t.is_empty() => format!("Rebase onto {t}"),
            _ => "Rebase".to_string(),
        },
        "rebase-from-here" => "Rebase from commit".to_string(),
        "interactive-rebase" => "Interactive rebase".to_string(),
        "cherry-pick" | "cherry-pick-continue" => match target {
            Some(t) if !t.is_empty() => format!("Cherry-pick {}", &t[..t.len().min(7)]),
            _ => "Cherry-pick".to_string(),
        },
        "revert" | "revert-continue" => match target {
            Some(t) if !t.is_empty() => format!("Revert {}", &t[..t.len().min(7)]),
            _ => "Revert".to_string(),
        },
        "reset-soft" => "Soft reset".to_string(),
        "reset-mixed" => "Mixed reset".to_string(),
        "reset-hard" => "Hard reset".to_string(),
        "checkout" => match target {
            Some(t) if !t.is_empty() => format!("Checkout {t}"),
            _ => "Checkout".to_string(),
        },
        "checkout-commit" => match target {
            Some(t) if !t.is_empty() => format!("Checkout {}", &t[..t.len().min(7)]),
            _ => "Checkout commit".to_string(),
        },
        "checkout-tag" => match target {
            Some(t) if !t.is_empty() => format!("Checkout tag {t}"),
            _ => "Checkout tag".to_string(),
        },
        "create-branch" => {
            let name = meta_name.or(target).unwrap_or("");
            if name.is_empty() {
                "Create branch".to_string()
            } else {
                format!("Create branch {name}")
            }
        }
        "stash" => "Stash changes".to_string(),
        "pop-stash" => "Pop stash".to_string(),
        "apply-stash" => "Apply stash".to_string(),
        "stage" | "stage-patch" => match target {
            Some(t) if !t.is_empty() => format!("Stage {t}"),
            _ => "Stage file".to_string(),
        },
        "unstage" | "unstage-patch" => match target {
            Some(t) if !t.is_empty() => format!("Unstage {t}"),
            _ => "Unstage file".to_string(),
        },
        "stage-all" => "Stage all".to_string(),
        "unstage-all" => "Unstage all".to_string(),
        "resolve-conflict-ours"
        | "resolve-conflict-theirs"
        | "resolve-conflict-block"
        | "mark-conflict-resolved" => match target {
            Some(t) if !t.is_empty() => format!("Resolve {t}"),
            _ => "Resolve conflict".to_string(),
        },
        _ => kind.to_string(),
    }
}

// ---------------- rebase editor bundle ----------------

pub struct RebaseEditorBundle {
    pub env: Vec<(String, String)>,
    dir: PathBuf,
}

impl Drop for RebaseEditorBundle {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

/// Pre-built todo list + optional reword messages without an external editor.
/// Shell scripts on unix, batch files on Windows (node is not guaranteed
/// on user machines).
pub fn create_rebase_editor_bundle(
    entries: &[(String, String, String, Option<String>)],
) -> Result<RebaseEditorBundle, GitError> {
    let dir = std::env::temp_dir().join(format!("git-light-rebase-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir)
        .map_err(|e| GitError::unknown(format!("could not create rebase bundle dir: {e}")))?;
    let todo_path = dir.join("todo");
    let todo: String = entries
        .iter()
        .map(|(action, sha, subject, _)| todo_line(action, sha, subject))
        .collect();
    std::fs::write(&todo_path, &todo)
        .map_err(|e| GitError::unknown(format!("could not write rebase todo: {e}")))?;

    let rewords: Vec<String> = entries
        .iter()
        .filter_map(|(_, _, _, m)| m.clone())
        .collect();
    // Windows: drive the editors with PowerShell (`-File` + single-quoted
    // literal paths). This avoids cmd.exe command-line parsing entirely —
    // quoted `cmd /C` invocations get mangled for TEMP paths under
    // `C:\Users\...` (`'unneradmin' is not recognized as an internal or
    // external command`, even with forward slashes). Forward slashes need
    // no escaping in PowerShell; an embedded `'` is doubled. `-LiteralPath`
    // avoids wildcard parsing, and `$ErrorActionPreference = 'Stop'`
    // promotes cmdlet failures to terminating errors so git sees exit 1.
    let slash = |p: &Path| p.display().to_string().replace('\\', "/");
    let pslit = |p: &Path| slash(p).replace('\'', "''");
    let (seq_editor, msg_editor) = if cfg!(target_os = "windows") {
        let seq = dir.join("seq-editor.ps1");
        std::fs::write(
            &seq,
            format!(
                "$ErrorActionPreference = 'Stop'\nCopy-Item -LiteralPath '{}' -Destination $args[0] -Force\n",
                pslit(&todo_path)
            ),
        )
        .map_err(|e| GitError::unknown(e.to_string()))?;
        let msg_dir = dir.join("msgs");
        std::fs::create_dir_all(&msg_dir).map_err(|e| GitError::unknown(e.to_string()))?;
        for (i, msg) in rewords.iter().enumerate() {
            let mut text = msg.clone();
            if !text.ends_with('\n') {
                text.push('\n');
            }
            std::fs::write(msg_dir.join(format!("msg-{i}")), text)
                .map_err(|e| GitError::unknown(e.to_string()))?;
        }
        std::fs::write(dir.join("reword-index"), "0")
            .map_err(|e| GitError::unknown(e.to_string()))?;
        let msg = dir.join("msg-editor.ps1");
        std::fs::write(
            &msg,
            format!(
                "$ErrorActionPreference = 'Stop'\n$idx = [int](Get-Content -LiteralPath '{}' -Raw)\nCopy-Item -LiteralPath ('{}/msg-' + $idx) -Destination $args[0] -Force\nSet-Content -LiteralPath '{}' -Value ($idx + 1) -NoNewline\n",
                pslit(&dir.join("reword-index")),
                pslit(&msg_dir),
                pslit(&dir.join("reword-index"))
            ),
        )
        .map_err(|e| GitError::unknown(e.to_string()))?;
        (
            format!(
                "powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"{}\"",
                slash(&seq)
            ),
            format!(
                "powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"{}\"",
                slash(&msg)
            ),
        )
    } else {
        let seq = dir.join("seq-editor.sh");
        std::fs::write(
            &seq,
            format!("#!/bin/sh\ncp \"{}\" \"$1\"\n", todo_path.display()),
        )
        .map_err(|e| GitError::unknown(e.to_string()))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&seq, std::fs::Permissions::from_mode(0o755));
        }
        let msg_dir = dir.join("msgs");
        std::fs::create_dir_all(&msg_dir).map_err(|e| GitError::unknown(e.to_string()))?;
        for (i, msg) in rewords.iter().enumerate() {
            let mut text = msg.clone();
            if !text.ends_with('\n') {
                text.push('\n');
            }
            std::fs::write(msg_dir.join(format!("msg-{i}")), text)
                .map_err(|e| GitError::unknown(e.to_string()))?;
        }
        std::fs::write(dir.join("reword-index"), "0")
            .map_err(|e| GitError::unknown(e.to_string()))?;
        let msg = dir.join("msg-editor.sh");
        std::fs::write(
            &msg,
            format!(
                "#!/bin/sh\nIDX=$(cat \"{}\")\nIDX=${{IDX:-0}}\ncp \"{}/msg-$IDX\" \"$1\"\necho $((IDX + 1)) > \"{}\"\n",
                dir.join("reword-index").display(),
                msg_dir.display(),
                dir.join("reword-index").display()
            ),
        )
        .map_err(|e| GitError::unknown(e.to_string()))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&msg, std::fs::Permissions::from_mode(0o755));
        }
        (
            format!("sh \"{}\"", seq.display()),
            format!("sh \"{}\"", msg.display()),
        )
    };
    Ok(RebaseEditorBundle {
        env: vec![
            ("GIT_SEQUENCE_EDITOR".to_string(), seq_editor),
            ("GIT_EDITOR".to_string(), msg_editor),
        ],
        dir,
    })
}

// ---------------- execute ----------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionEnvelope {
    pub ok: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<GitError>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflicts: Option<Vec<String>>,
}

impl ActionEnvelope {
    fn ok(message: String) -> Self {
        Self {
            ok: true,
            message,
            error: None,
            conflicts: None,
        }
    }

    pub fn err(error: GitError) -> Self {
        let conflicts = error.files.clone().filter(|f| !f.is_empty());
        Self {
            ok: false,
            message: error.message.clone(),
            error: Some(error),
            conflicts,
        }
    }
}

fn meta_str<'a>(meta: &'a serde_json::Value, key: &str) -> Option<&'a str> {
    meta.get(key)?.as_str()
}

fn meta_bool(meta: &serde_json::Value, key: &str) -> bool {
    meta.get(key).and_then(|v| v.as_bool()).unwrap_or(false)
}

fn s_arg(value: &str) -> String {
    value.to_string()
}

/// Cap for captured git output (stdout/stderr each). Prevents a huge
/// `git log/diff/status` from ballooning renderer memory.
pub const MAX_OUTPUT_BYTES: usize = 8 * 1024 * 1024;

fn truncate_output(mut buf: Vec<u8>) -> Vec<u8> {
    if buf.len() > MAX_OUTPUT_BYTES {
        buf.truncate(MAX_OUTPUT_BYTES);
    }
    buf
}

/// Reject values that could be parsed as CLI flags or inject new argv
/// entries (e.g. a branch named `-h` or a ref containing a newline).
fn reject_option_like(value: &str, what: &str) -> Result<(), GitError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(GitError::unknown(format!("{what} is required.")));
    }
    if trimmed.starts_with('-') || trimmed.contains(['\0', '\n', '\r']) {
        return Err(GitError::unknown(format!("Invalid {what}.")));
    }
    Ok(())
}

fn checked_target<'a>(target: Option<&'a str>, what: &str) -> Result<&'a str, GitError> {
    let value = target
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| GitError::unknown(format!("{what} is required.")))?;
    reject_option_like(value, what)?;
    Ok(value)
}

fn checked_meta<'a>(
    meta: &'a serde_json::Value,
    key: &str,
    what: &str,
) -> Result<&'a str, GitError> {
    let value = meta
        .get(key)
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| GitError::unknown(format!("{what} is required.")))?;
    reject_option_like(value, what)?;
    Ok(value)
}

/// A rev spec is valid when it is short, has no whitespace/control chars,
/// and does not look like a CLI flag. Git itself is the final validator.
fn checked_rev(value: &str, what: &str) -> Result<String, GitError> {
    let trimmed = value.trim();
    reject_option_like(trimmed, what)?;
    if trimmed.len() > 256 || trimmed.contains(char::is_whitespace) || trimmed.contains('\0') {
        return Err(GitError::unknown(format!("Invalid {what}.")));
    }
    Ok(trimmed.to_string())
}

/// Single-line text for the rebase todo file: newlines would inject extra
/// todo entries, so collapse them to spaces.
fn todo_line(action: &str, sha: &str, subject: &str) -> String {
    let clean = |s: &str| s.replace(['\r', '\n'], " ");
    format!("{} {} {}\n", clean(action), clean(sha), clean(subject))
}

/// Full execute flow: journal checkpoint, route, push-undo, progress.
/// Mirrors `GitProvider.execute`.
#[allow(clippy::too_many_arguments)]
pub async fn execute_action(
    operation_id: &str,
    cwd: &Path,
    git_dir: &Path,
    kind: &str,
    target: Option<&str>,
    meta: &serde_json::Value,
    journal: &tokio::sync::Mutex<Journal>,
    ops: &tokio::sync::Mutex<Operations>,
    emit: &(dyn Fn(&str, Option<u32>, bool) + Send + Sync),
) -> ActionEnvelope {
    let cancel_rx = ops.lock().await.register(operation_id);
    let repo_state = read_repo_state(git_dir);

    let squash_merge = kind == "merge"
        && meta
            .get("squash")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
    let capture_kind = if squash_merge {
        None
    } else {
        journal_capture_for(kind)
    };
    let mut checkpoint = None;
    if let Some(cap) = capture_kind {
        if let Ok(mut cp) = journal.lock().await.capture(cwd, &cap).await {
            match kind {
                "reset-soft" => cp.reset_mode = Some("soft".to_string()),
                "reset-mixed" => cp.reset_mode = Some("mixed".to_string()),
                "reset-hard" => cp.reset_mode = Some("hard".to_string()),
                _ => {}
            }
            checkpoint = Some(cp);
        }
    }

    emit("Starting…", Some(0), false);
    let progress_cb = |phase: &str| emit(phase, None, false);
    let result = route_action(
        cwd,
        kind,
        target,
        meta,
        journal,
        &cancel_rx,
        &progress_cb,
        &repo_state,
    )
    .await;
    ops.lock().await.unregister(operation_id);

    match result {
        Ok(message) => {
            if let Some(cp) = checkpoint {
                if is_journalable_action(kind) {
                    let label =
                        journal_label(kind, target, meta.get("name").and_then(|v| v.as_str()));
                    journal.lock().await.push_undo(cp, label);
                }
            }
            emit("Done", Some(100), true);
            ActionEnvelope::ok(message)
        }
        Err(error) => {
            emit("Done", Some(100), true);
            ActionEnvelope::err(error)
        }
    }
}

fn is_lfs_missing(message: &str) -> bool {
    let m = message.to_lowercase();
    m.contains("not a git command")
        || m.match_indices("lfs")
            .any(|(i, _)| m[i..].contains("not found"))
}

fn lfs_error(error: GitError) -> GitError {
    if is_lfs_missing(&error.message) {
        GitError::unknown("Git LFS is not installed. Install git-lfs, then retry.".to_string())
    } else {
        error
    }
}

#[allow(clippy::too_many_lines)]
#[allow(clippy::too_many_arguments)]
async fn route_action(
    cwd: &Path,
    kind: &str,
    target: Option<&str>,
    meta: &serde_json::Value,
    journal: &tokio::sync::Mutex<Journal>,
    cancel: &watch::Receiver<()>,
    on_progress: &(dyn Fn(&str) + Send + Sync),
    repo_state: &RepoState,
) -> Result<String, GitError> {
    let run =
        |args: Vec<String>| run_git(cwd, args, RunOptions::default(), Some(cancel.clone()), None);
    let run_allow = |args: Vec<String>| {
        run_git(
            cwd,
            args,
            RunOptions {
                allow_failure: true,
                ..RunOptions::default()
            },
            Some(cancel.clone()),
            None,
        )
    };
    let run_stream = |args: Vec<String>| {
        run_git_streaming(
            cwd,
            args,
            RunOptions::default(),
            Some(cancel.clone()),
            on_progress,
        )
    };
    let no_target = || GitError::unknown("No target specified.".to_string());

    // Semantic validation (argv arrays already prevent shell injection, but
    // a value like `-h` would still be parsed as a flag by git itself).
    // Ref-like targets are validated per-kind below via `checked_target`;
    // here we reject obviously dangerous targets early for the ref family.
    if let Some(target) = target {
        let ref_kinds = [
            "checkout",
            "merge",
            "rebase",
            "cherry-pick",
            "reset-soft",
            "reset-mixed",
            "reset-hard",
            "revert",
            "create-branch",
            "rename-branch",
            "delete-branch",
            "force-delete-branch",
            "set-upstream",
            "delete-tag",
            "create-tag",
            "bisect-good",
            "bisect-bad",
        ];
        if ref_kinds.contains(&kind) {
            reject_option_like(target.trim(), "target")?;
        }
        if kind == "stage-patch" || kind == "discard-patch" {
            let patch = meta.get("patch").and_then(|v| v.as_str()).unwrap_or("");
            if !patch.starts_with("diff --git") || patch.contains('\0') {
                return Err(GitError::unknown("Invalid patch.".to_string()));
            }
        }
    }

    match kind {
        "fetch" => {
            run_stream(vec![s_arg("fetch"), s_arg("--all")]).await?;
            Ok("Fetched from all remotes".to_string())
        }
        "fetch-all" => {
            run_stream(vec![s_arg("fetch"), s_arg("--all"), s_arg("--prune")]).await?;
            Ok("Fetched and pruned remotes".to_string())
        }
        "pull" => {
            run(vec![s_arg("pull"), s_arg("--ff-only")]).await?;
            Ok("Pulled latest changes".to_string())
        }
        "push" => {
            run_stream(vec![s_arg("push")]).await?;
            Ok("Pushed to remote".to_string())
        }
        "force-push" => {
            run_stream(vec![s_arg("push"), s_arg("--force-with-lease")]).await?;
            Ok("Force-pushed to remote".to_string())
        }
        "push-tags" => {
            run(vec![s_arg("push"), s_arg("--tags")]).await?;
            Ok("Pushed tags".to_string())
        }
        "prune" => {
            let remote = meta_str(meta, "remote")
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .unwrap_or("origin");
            reject_option_like(remote, "remote")?;
            run(vec![s_arg("remote"), s_arg("prune"), s_arg(remote)]).await?;
            Ok(format!("Pruned stale remote branches ({remote})"))
        }
        "sync" => {
            run_stream(vec![s_arg("fetch"), s_arg("--all")]).await?;
            run(vec![s_arg("pull"), s_arg("--ff-only")]).await?;
            Ok("Synced with remote".to_string())
        }

        "stash" => {
            let msg = meta_str(meta, "message").unwrap_or("WIP");
            let mut args = vec![s_arg("stash"), s_arg("push"), s_arg("-m"), s_arg(msg)];
            if meta_bool(meta, "includeUntracked") {
                args.push(s_arg("-u"));
            }
            if meta_bool(meta, "keepIndex") {
                args.push(s_arg("-k"));
            }
            run(args).await?;
            Ok("Saved working tree to stash".to_string())
        }
        "pop-stash" => {
            let stash_ref = checked_rev(target.unwrap_or("stash@{0}"), "stash")?;
            run(vec![s_arg("stash"), s_arg("pop"), s_arg(&stash_ref)]).await?;
            Ok("Popped stash".to_string())
        }
        "apply-stash" => {
            let stash_ref = checked_rev(target.unwrap_or("stash@{0}"), "stash")?;
            run(vec![s_arg("stash"), s_arg("apply"), s_arg(&stash_ref)]).await?;
            Ok("Applied stash".to_string())
        }
        "drop-stash" => {
            let stash_ref = checked_rev(target.unwrap_or("stash@{0}"), "stash")?;
            run(vec![s_arg("stash"), s_arg("drop"), s_arg(&stash_ref)]).await?;
            Ok("Dropped stash".to_string())
        }
        "rename-stash" => {
            let stash_ref = &checked_rev(target.unwrap_or("stash@{0}"), "stash")?;
            let message = meta_str(meta, "message").map(str::trim).unwrap_or("");
            if message.is_empty() {
                return Err(GitError::unknown("Stash message is required.".to_string()));
            }
            let rev = run(vec![s_arg("rev-parse"), s_arg(stash_ref)]).await?;
            let sha = rev.stdout.trim().to_string();
            if sha.is_empty() {
                return Err(GitError::unknown(
                    "Could not resolve stash ref.".to_string(),
                ));
            }
            // `stash store` with the same sha while the ref exists is a no-op,
            // so drop first (sha stays in the object db) then re-store.
            run(vec![s_arg("stash"), s_arg("drop"), s_arg(stash_ref)]).await?;
            run(vec![
                s_arg("stash"),
                s_arg("store"),
                s_arg("-m"),
                s_arg(message),
                s_arg(&sha),
            ])
            .await
            .map_err(|_| {
                GitError::unknown(format!(
                    "Renamed stash was dropped but re-storing failed (recover with {sha})."
                ))
            })?;
            Ok("Renamed stash".to_string())
        }

        "stage" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let safe = crate::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            run(vec![s_arg("add"), s_arg("--"), s_arg(&safe)]).await?;
            Ok(format!("Staged {t}"))
        }
        "unstage" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let safe = crate::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            run(vec![
                s_arg("restore"),
                s_arg("--staged"),
                s_arg("--"),
                s_arg(&safe),
            ])
            .await?;
            Ok(format!("Unstaged {t}"))
        }
        "stage-all" => {
            run(vec![s_arg("add"), s_arg("-A")]).await?;
            Ok("Staged all changes".to_string())
        }
        "unstage-all" => {
            run(vec![
                s_arg("restore"),
                s_arg("--staged"),
                s_arg("--"),
                s_arg("."),
            ])
            .await?;
            Ok("Unstaged all changes".to_string())
        }
        "discard-file" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let safe = crate::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            let attempt = run(vec![
                s_arg("restore"),
                s_arg("--source=HEAD"),
                s_arg("--staged"),
                s_arg("--worktree"),
                s_arg("--"),
                s_arg(&safe),
            ])
            .await;
            if let Err(error) = attempt {
                // Untracked files are unknown to git — restore fails with a
                // pathspec error, so delete them from disk instead.
                let msg = error.message.to_lowercase();
                if msg.contains("did not match any file") && msg.contains("known to git") {
                    let full = cwd.join(&safe);
                    let _ = if full.is_dir() {
                        std::fs::remove_dir_all(&full)
                    } else {
                        std::fs::remove_file(&full)
                    };
                } else {
                    return Err(error);
                }
            }
            Ok(format!("Discarded changes in {t}"))
        }
        "discard-all" => {
            run(vec![
                s_arg("restore"),
                s_arg("--source=HEAD"),
                s_arg("--staged"),
                s_arg("--worktree"),
                s_arg("--"),
                s_arg("."),
            ])
            .await?;
            Ok("Discarded all changes".to_string())
        }
        "restore-file" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let sha = checked_rev(meta_str(meta, "sha").unwrap_or("HEAD"), "revision")?;
            let safe = crate::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            run(vec![
                s_arg("restore"),
                s_arg("--source"),
                s_arg(&sha),
                s_arg("--"),
                s_arg(&safe),
            ])
            .await?;
            Ok(format!("Restored {t} from {}", &sha[..sha.len().min(7)]))
        }

        "stage-patch" | "unstage-patch" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let patch = meta_str(meta, "patch").unwrap_or("");
            if patch.trim().is_empty() {
                return Err(GitError::unknown("No patch specified.".to_string()));
            }
            let safe = crate::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            if meta_bool(meta, "intentToAdd") {
                run_allow(vec![s_arg("add"), s_arg("-N"), s_arg("--"), s_arg(&safe)]).await?;
            }
            if !patch.starts_with("diff --git") {
                return Err(GitError::unknown("Invalid patch.".to_string()));
            }
            let mut apply_args = vec![
                s_arg("apply"),
                s_arg("--cached"),
                s_arg(&format!("--include={safe}")),
            ];
            if kind == "unstage-patch" {
                apply_args.push(s_arg("-R"));
            }
            run_git(
                cwd,
                apply_args,
                RunOptions {
                    input: Some(patch.to_string()),
                    ..RunOptions::default()
                },
                Some(cancel.clone()),
                None,
            )
            .await?;
            Ok(if kind == "unstage-patch" {
                format!("Unstaged hunk in {t}")
            } else {
                format!("Staged hunk in {t}")
            })
        }
        "discard-patch" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let patch = meta_str(meta, "patch").unwrap_or("");
            if patch.trim().is_empty() {
                return Err(GitError::unknown("No patch specified.".to_string()));
            }
            let safe = crate::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            if meta_bool(meta, "intentToAdd") {
                run_allow(vec![s_arg("add"), s_arg("-N"), s_arg("--"), s_arg(&safe)]).await?;
            }
            if !patch.starts_with("diff --git") {
                return Err(GitError::unknown("Invalid patch.".to_string()));
            }
            run_git(
                cwd,
                vec![
                    s_arg("apply"),
                    s_arg("-R"),
                    s_arg(&format!("--include={safe}")),
                ],
                RunOptions {
                    input: Some(patch.to_string()),
                    ..RunOptions::default()
                },
                Some(cancel.clone()),
                None,
            )
            .await?;
            Ok(format!("Discarded hunk in {t}"))
        }

        "resolve-conflict-ours" | "resolve-conflict-theirs" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let safe = crate::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            let side = if kind == "resolve-conflict-ours" {
                "--ours"
            } else {
                "--theirs"
            };
            run(vec![
                s_arg("checkout"),
                s_arg(side),
                s_arg("--"),
                s_arg(&safe),
            ])
            .await?;
            run(vec![s_arg("add"), s_arg("--"), s_arg(&safe)]).await?;
            let label = if kind == "resolve-conflict-ours" {
                "ours"
            } else {
                "theirs"
            };
            Ok(format!("Resolved {t} using {label}"))
        }
        "resolve-conflict-block" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let safe = crate::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            let block_index: usize = meta
                .get("blockIndex")
                .and_then(|v| v.as_u64())
                .unwrap_or(u64::MAX) as usize;
            let side = if meta_str(meta, "side") == Some("theirs") {
                "theirs"
            } else {
                "ours"
            };
            if block_index == usize::MAX {
                return Err(GitError::unknown(
                    "Invalid conflict block index.".to_string(),
                ));
            }
            let full = cwd.join(&safe);
            let content = std::fs::read_to_string(&full)
                .map_err(|e| GitError::unknown(format!("could not read conflicted file: {e}")))?;
            let updated = crate::diff::apply_conflict_resolution(&content, block_index, side)?;
            std::fs::write(&full, updated.as_bytes())
                .map_err(|e| GitError::unknown(format!("could not write conflicted file: {e}")))?;
            if !crate::diff::parse_conflict_markers(&updated).has_markers {
                run(vec![s_arg("add"), s_arg("--"), s_arg(&safe)]).await?;
            }
            Ok(format!("Resolved conflict block in {t}"))
        }
        "mark-conflict-resolved" => {
            let t = target.ok_or_else(|| GitError::unknown("No file specified.".to_string()))?;
            let safe = crate::diff::assert_path_inside_repo(&cwd.to_string_lossy(), t)?;
            run(vec![s_arg("add"), s_arg("--"), s_arg(&safe)]).await?;
            Ok(format!("Marked {t} as resolved"))
        }

        "commit" => {
            let title = meta_str(meta, "message").map(str::trim).unwrap_or("");
            if title.is_empty() {
                return Err(GitError::new(
                    "NothingToCommit",
                    "Commit message is required.".to_string(),
                ));
            }
            let mut args = vec![s_arg("commit"), s_arg("-m"), s_arg(title)];
            if let Some(body) = meta_str(meta, "body")
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                args.push(s_arg("-m"));
                args.push(s_arg(body));
            }
            if meta_bool(meta, "signOff") {
                args.push(s_arg("--signoff"));
            }
            if meta_bool(meta, "sign") {
                args.push(s_arg("-S"));
            }
            run(args).await?;
            Ok("Created commit".to_string())
        }
        "amend" => {
            let title = meta_str(meta, "message").map(str::trim).unwrap_or("");
            let mut args = vec![s_arg("commit"), s_arg("--amend"), s_arg("--no-edit")];
            if !title.is_empty() {
                args = vec![s_arg("commit"), s_arg("--amend"), s_arg("-m"), s_arg(title)];
                if let Some(body) = meta_str(meta, "body")
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                {
                    args.push(s_arg("-m"));
                    args.push(s_arg(body));
                }
            }
            if meta_bool(meta, "signOff") {
                args.push(s_arg("--signoff"));
            }
            if meta_bool(meta, "sign") {
                args.push(s_arg("-S"));
            }
            run(args).await?;
            Ok("Amended commit".to_string())
        }
        "commit-and-push" | "commit-and-force-push" => {
            let commit_kind = if meta_bool(meta, "amend") {
                "amend"
            } else {
                "commit"
            };
            Box::pin(route_action(
                cwd,
                commit_kind,
                target,
                meta,
                journal,
                cancel,
                on_progress,
                repo_state,
            ))
            .await?;
            let push_kind = if kind == "commit-and-force-push" {
                "force-push"
            } else {
                "push"
            };
            Box::pin(route_action(
                cwd,
                push_kind,
                None,
                meta,
                journal,
                cancel,
                on_progress,
                repo_state,
            ))
            .await?;
            Ok(if meta_bool(meta, "amend") {
                if kind == "commit-and-force-push" {
                    "Amended and force-pushed".to_string()
                } else {
                    "Amended and pushed".to_string()
                }
            } else if kind == "commit-and-force-push" {
                "Committed and force-pushed".to_string()
            } else {
                "Committed and pushed".to_string()
            })
        }

        "checkout" => {
            let t = checked_target(target, "branch")?;
            if let Some(remote) = meta_str(meta, "remote") {
                let remote = remote.trim();
                reject_option_like(remote, "remote")?;
                let remote_ref = format!("{remote}/{t}");
                let created = run_allow(vec![
                    s_arg("checkout"),
                    s_arg("-b"),
                    s_arg(t),
                    s_arg(&remote_ref),
                ])
                .await?;
                if created.exit_code != Some(0) {
                    run(vec![s_arg("checkout"), s_arg(t)]).await?;
                }
            } else {
                run(vec![s_arg("checkout"), s_arg(t)]).await?;
            }
            Ok(format!("Checked out {t}"))
        }
        "checkout-commit" => {
            let t = target.ok_or_else(no_target)?;
            let rev = checked_rev(t, "commit")?;
            run(vec![s_arg("checkout"), s_arg("--detach"), s_arg(&rev)]).await?;
            Ok(format!(
                "Checked out {} (detached HEAD)",
                &rev[..rev.len().min(7)]
            ))
        }
        "create-branch" => {
            let name = match meta_str(meta, "name")
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                Some(name) => {
                    reject_option_like(name, "branch name")?;
                    name.to_string()
                }
                None => checked_target(target, "branch name")?.to_string(),
            };
            if let Some(start) = meta_str(meta, "startPoint") {
                let start = checked_rev(start, "start point")?;
                run(vec![
                    s_arg("checkout"),
                    s_arg("-b"),
                    s_arg(&name),
                    s_arg(&start),
                ])
                .await?;
            } else {
                run(vec![s_arg("checkout"), s_arg("-b"), s_arg(&name)]).await?;
            }
            Ok(format!("Created and checked out {name}"))
        }
        "rename-branch" => {
            let new_name = meta_str(meta, "newName")
                .or(meta_str(meta, "name"))
                .map(str::trim)
                .unwrap_or("");
            if new_name.is_empty() {
                return Err(GitError::unknown("Branch names required.".to_string()));
            }
            reject_option_like(new_name, "branch name")?;
            let t = checked_target(target, "branch")?;
            run(vec![
                s_arg("branch"),
                s_arg("-m"),
                s_arg(t),
                s_arg(new_name),
            ])
            .await?;
            Ok(format!("Renamed branch to {new_name}"))
        }
        "delete-branch" => {
            let t = checked_target(target, "branch")?;
            let flag = if meta_bool(meta, "force") { "-D" } else { "-d" };
            run(vec![s_arg("branch"), s_arg(flag), s_arg(t)]).await?;
            Ok(format!("Deleted branch {t}"))
        }
        "delete-remote-branch" => {
            let t = checked_target(target, "remote branch")?;
            let explicit = meta_str(meta, "remote").map(str::trim).unwrap_or("");
            if !explicit.is_empty() {
                reject_option_like(explicit, "remote")?;
            }
            let (remote, branch) = if !explicit.is_empty() {
                (explicit.to_string(), t.to_string())
            } else if let Some(slash) = t.find('/') {
                (t[..slash].to_string(), t[slash + 1..].to_string())
            } else {
                ("origin".to_string(), t.to_string())
            };
            if branch.is_empty() {
                return Err(GitError::unknown("No remote branch specified.".to_string()));
            }
            reject_option_like(&remote, "remote")?;
            reject_option_like(&branch, "branch")?;
            run(vec![
                s_arg("push"),
                s_arg(&remote),
                s_arg("--delete"),
                s_arg(&branch),
            ])
            .await?;
            Ok(format!("Deleted remote branch {branch}"))
        }
        "set-upstream" => {
            let t = checked_target(target, "upstream")?;
            // Upstream must be `<remote>/<branch>`; validate both halves.
            let (remote, branch) = t.split_once('/').ok_or_else(|| {
                GitError::unknown("Upstream must be <remote>/<branch>.".to_string())
            })?;
            reject_option_like(remote, "remote")?;
            reject_option_like(branch, "branch")?;
            run(vec![s_arg("branch"), s_arg("-u"), s_arg(t)]).await?;
            Ok(format!("Set upstream to {t}"))
        }
        "compare-branches" => {
            let t = checked_target(target, "branch")?;
            let other = checked_meta(meta, "other", "branch")?;
            let out = run(vec![
                s_arg("log"),
                s_arg("--oneline"),
                s_arg(&format!("{t}..{other}")),
            ])
            .await?;
            let count = out.stdout.lines().filter(|l| !l.trim().is_empty()).count();
            Ok(format!("{count} commits in {other} not in {t}"))
        }

        "worktree-add" => {
            let wt_path = meta_str(meta, "path").unwrap_or("");
            if wt_path.trim().is_empty() {
                return Err(GitError::unknown("Worktree path required.".to_string()));
            }
            reject_option_like(wt_path.trim(), "worktree path")?;
            let mut args = vec![s_arg("worktree"), s_arg("add"), s_arg(wt_path)];
            if let Some(branch) = meta_str(meta, "branch") {
                let branch = branch.trim();
                if !branch.is_empty() {
                    reject_option_like(branch, "branch")?;
                    args.push(s_arg(branch));
                }
            }
            run(args).await?;
            Ok(format!("Added worktree at {wt_path}"))
        }
        "worktree-remove" => {
            let t = checked_target(target, "worktree path")?;
            run(vec![s_arg("worktree"), s_arg("remove"), s_arg(t)]).await?;
            Ok(format!("Removed worktree at {t}"))
        }

        "lfs-track" => {
            let t = checked_target(target, "tracking pattern")?;
            run(vec![s_arg("lfs"), s_arg("track"), s_arg(t)])
                .await
                .map_err(lfs_error)?;
            Ok(format!("Tracking {t} with Git LFS"))
        }
        "lfs-untrack" => {
            let t = checked_target(target, "tracking pattern")?;
            run(vec![s_arg("lfs"), s_arg("untrack"), s_arg(t)])
                .await
                .map_err(lfs_error)?;
            Ok(format!("Stopped tracking {t} with Git LFS"))
        }
        "lfs-prune" => {
            run(vec![s_arg("lfs"), s_arg("prune")])
                .await
                .map_err(lfs_error)?;
            Ok("Pruned local Git LFS objects".to_string())
        }

        "merge" => {
            let t = checked_target(target, "branch")?;
            let mut args = vec![s_arg("merge")];
            if meta_bool(meta, "ffOnly") {
                args.push(s_arg("--ff-only"));
            } else if meta_bool(meta, "noFf") {
                args.push(s_arg("--no-ff"));
            } else if meta_bool(meta, "squash") {
                args.push(s_arg("--squash"));
            }
            args.push(s_arg(t));
            run(args).await?;
            if meta_bool(meta, "squash") {
                Ok(format!("Squashed {t} — review staged changes and commit"))
            } else {
                Ok(format!("Merged {t}"))
            }
        }
        "merge-continue" => {
            run(vec![s_arg("merge"), s_arg("--continue")]).await?;
            Ok("Merge completed".to_string())
        }
        "merge-abort" => {
            run(vec![s_arg("merge"), s_arg("--abort")]).await?;
            Ok("Merge aborted".to_string())
        }

        "rebase" => {
            let t = checked_target(target, "upstream")?;
            run(vec![s_arg("rebase"), s_arg(t)]).await?;
            Ok(format!("Rebased onto {t}"))
        }
        "rebase-from-here" => {
            let t = target.ok_or_else(|| GitError::unknown("No commit specified.".to_string()))?;
            let rev = checked_rev(t, "commit")?;
            run(vec![
                s_arg("rebase"),
                s_arg("--onto"),
                s_arg(&rev),
                s_arg("HEAD~1"),
            ])
            .await?;
            Ok("Rebased from commit".to_string())
        }
        "interactive-rebase" => {
            let t = target.ok_or_else(|| GitError::unknown("No base specified.".to_string()))?;
            let base = checked_rev(t, "base")?;
            let entries = meta
                .get("entries")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            if entries.is_empty() {
                return Err(GitError::unknown("No rebase plan specified.".to_string()));
            }
            if entries.len() > 500 {
                return Err(GitError::unknown("Rebase plan is too large.".to_string()));
            }
            const REBASE_ACTIONS: &[&str] = &["pick", "reword", "edit", "squash", "fixup", "drop"];
            let mut todo_entries = Vec::new();
            for e in &entries {
                let action = e.get("action").and_then(|v| v.as_str()).unwrap_or("pick");
                if !REBASE_ACTIONS.contains(&action) {
                    return Err(GitError::unknown("Invalid rebase action.".to_string()));
                }
                let sha = e.get("sha").and_then(|v| v.as_str()).unwrap_or("");
                let sha = checked_rev(sha, "commit")?;
                let subject = e.get("subject").and_then(|v| v.as_str()).unwrap_or("");
                if subject.len() > 4096 {
                    return Err(GitError::unknown("Rebase subject is too long.".to_string()));
                }
                let message = e
                    .get("message")
                    .and_then(|v| v.as_str())
                    .map(str::to_string);
                todo_entries.push((
                    action.to_string(),
                    sha.to_string(),
                    subject.to_string(),
                    message,
                ));
            }
            let bundle = create_rebase_editor_bundle(&todo_entries)?;
            let env: Vec<(String, String)> = bundle.env.clone();
            let result = run_git(
                cwd,
                vec![s_arg("rebase"), s_arg("-i"), s_arg(&base)],
                RunOptions {
                    timeout: None,
                    extra_env: env,
                    ..RunOptions::default()
                },
                Some(cancel.clone()),
                None,
            )
            .await;
            drop(bundle);
            result?;
            Ok("Interactive rebase started".to_string())
        }
        "rebase-continue" => {
            run(vec![s_arg("rebase"), s_arg("--continue")]).await?;
            Ok("Rebase continued".to_string())
        }
        "rebase-abort" => {
            run(vec![s_arg("rebase"), s_arg("--abort")]).await?;
            Ok("Rebase aborted".to_string())
        }
        "rebase-skip" => {
            run(vec![s_arg("rebase"), s_arg("--skip")]).await?;
            Ok("Rebase skipped commit".to_string())
        }

        "cherry-pick" => {
            let t = target.ok_or_else(|| GitError::unknown("No commit specified.".to_string()))?;
            let rev = checked_rev(t, "commit")?;
            run(vec![s_arg("cherry-pick"), s_arg(&rev)]).await?;
            Ok(format!("Cherry-picked {}", &rev[..rev.len().min(7)]))
        }
        "cherry-pick-continue" => {
            run(vec![s_arg("cherry-pick"), s_arg("--continue")]).await?;
            Ok("Cherry-pick continued".to_string())
        }
        "cherry-pick-abort" => {
            run(vec![s_arg("cherry-pick"), s_arg("--abort")]).await?;
            Ok("Cherry-pick aborted".to_string())
        }

        "bisect-start" => {
            let bad = match meta_str(meta, "bad")
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .or(target)
            {
                Some(value) => checked_rev(value, "revision")?,
                None => "HEAD".to_string(),
            };
            let good = match meta_str(meta, "good")
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                Some(value) => Some(checked_rev(value, "revision")?),
                None => None,
            };
            run(vec![s_arg("bisect"), s_arg("start")]).await?;
            let marked = async {
                run(vec![s_arg("bisect"), s_arg("bad"), s_arg(&bad)]).await?;
                if let Some(good) = good.as_ref() {
                    run(vec![s_arg("bisect"), s_arg("good"), s_arg(good)]).await?;
                }
                Ok::<(), GitError>(())
            }
            .await;
            if let Err(error) = marked {
                run(vec![s_arg("bisect"), s_arg("reset")]).await.ok();
                return Err(error);
            }
            Ok(match good.as_ref() {
                Some(good) => format!("Bisecting {bad} against {good}"),
                None => format!("Bisect started at {bad}"),
            })
        }
        "bisect-good" => {
            if let Some(t) = target {
                let rev = checked_rev(t, "revision")?;
                run(vec![s_arg("bisect"), s_arg("good"), s_arg(&rev)]).await?;
            } else {
                run(vec![s_arg("bisect"), s_arg("good")]).await?;
            }
            Ok("Marked commit as good".to_string())
        }
        "bisect-bad" => {
            if let Some(t) = target {
                let rev = checked_rev(t, "revision")?;
                run(vec![s_arg("bisect"), s_arg("bad"), s_arg(&rev)]).await?;
            } else {
                run(vec![s_arg("bisect"), s_arg("bad")]).await?;
            }
            Ok("Marked commit as bad".to_string())
        }
        "bisect-skip" => {
            run(vec![s_arg("bisect"), s_arg("skip")]).await?;
            Ok("Skipped commit during bisect".to_string())
        }
        "bisect-reset" => {
            run(vec![s_arg("bisect"), s_arg("reset")]).await?;
            Ok("Bisect ended".to_string())
        }

        "reset-soft" => {
            let rev = checked_rev(target.unwrap_or("HEAD"), "revision")?;
            run(vec![s_arg("reset"), s_arg("--soft"), s_arg(&rev)]).await?;
            Ok("Soft reset complete".to_string())
        }
        "reset-mixed" => {
            let rev = checked_rev(target.unwrap_or("HEAD"), "revision")?;
            run(vec![s_arg("reset"), s_arg("--mixed"), s_arg(&rev)]).await?;
            Ok("Mixed reset complete".to_string())
        }
        "reset-hard" => {
            let rev = checked_rev(target.unwrap_or("HEAD"), "revision")?;
            run(vec![s_arg("reset"), s_arg("--hard"), s_arg(&rev)]).await?;
            Ok("Hard reset complete".to_string())
        }

        "revert" => {
            let t = target.ok_or_else(|| GitError::unknown("No commit specified.".to_string()))?;
            let rev = checked_rev(t, "commit")?;
            run(vec![s_arg("revert"), s_arg("--no-edit"), s_arg(&rev)]).await?;
            Ok(format!("Reverted {}", &rev[..rev.len().min(7)]))
        }
        "revert-continue" => {
            run(vec![s_arg("revert"), s_arg("--continue")]).await?;
            Ok("Revert continued".to_string())
        }
        "revert-abort" => {
            run(vec![s_arg("revert"), s_arg("--abort")]).await?;
            Ok("Revert aborted".to_string())
        }

        "create-tag" | "tag" => {
            let name = match meta_str(meta, "name")
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                Some(name) => {
                    reject_option_like(name, "tag name")?;
                    name.to_string()
                }
                None => checked_target(target, "tag name")?.to_string(),
            };
            let mut args = if meta_bool(meta, "annotated") {
                vec![
                    s_arg("tag"),
                    s_arg("-a"),
                    s_arg(&name),
                    s_arg("-m"),
                    s_arg(meta_str(meta, "message").unwrap_or(&name)),
                ]
            } else {
                vec![s_arg("tag"), s_arg(&name)]
            };
            if let Some(sha) = meta_str(meta, "sha") {
                let sha = sha.trim();
                if !sha.is_empty() {
                    args.push(s_arg(&checked_rev(sha, "revision")?));
                }
            }
            run(args).await?;
            Ok(format!("Created tag {name}"))
        }
        "delete-tag" => {
            let t = checked_target(target, "tag")?;
            run(vec![s_arg("tag"), s_arg("-d"), s_arg(t)]).await?;
            Ok(format!("Deleted tag {t}"))
        }
        "checkout-tag" => {
            let t = checked_target(target, "tag")?;
            run(vec![s_arg("checkout"), s_arg("--detach"), s_arg(t)]).await?;
            Ok(format!("Checked out tag {t}"))
        }

        "refresh" => Ok("Repository refreshed".to_string()),
        "undo" => {
            if !is_undo_redo_safe(repo_state) {
                return Err(GitError::unknown(
                    "Cannot undo while an operation is in progress.".to_string(),
                ));
            }
            journal.lock().await.undo(cwd).await
        }
        "redo" => {
            if !is_undo_redo_safe(repo_state) {
                return Err(GitError::unknown(
                    "Cannot redo while an operation is in progress.".to_string(),
                ));
            }
            journal.lock().await.redo(cwd).await
        }
        "open-terminal" | "reveal-in-finder" | "open-remote" | "copy-sha" | "open-on-github" => {
            Ok("Handled in renderer".to_string())
        }
        _ => Err(GitError::unknown(format!("Unsupported action: {kind}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_authentication_failures() {
        let err = classify_git_error("fatal: Authentication failed for 'https://x'", Some(128));
        assert_eq!(err.code, "Authentication");
        assert!(err.message.contains("Authentication failed"));
    }

    #[test]
    fn classifies_conflicts_with_files() {
        let err = classify_git_error(
            "CONFLICT (content): Merge conflict in src/a.ts\nAuto-merging src/b.ts",
            Some(1),
        );
        assert_eq!(err.code, "MergeConflict");
        assert_eq!(
            err.files.unwrap(),
            vec!["src/a.ts".to_string(), "src/b.ts".to_string()]
        );
    }

    #[test]
    fn classifies_network_and_dirty_states() {
        assert_eq!(
            classify_git_error("fatal: could not resolve host github.com", Some(128)).code,
            "Network"
        );
        assert_eq!(
            classify_git_error("error: Your local changes would be overwritten", Some(1)).code,
            "DirtyWorktree"
        );
        assert_eq!(
            classify_git_error("fatal: not a git repository", Some(128)).code,
            "NotARepository"
        );
        assert_eq!(
            classify_git_error("nothing to commit, working tree clean", Some(1)).code,
            "NothingToCommit"
        );
    }

    #[test]
    fn unknown_errors_carry_exit_code() {
        let err = classify_git_error("", Some(1));
        assert_eq!(err.code, "Unknown");
        assert_eq!(err.detail.as_deref(), Some("git exited with code 1"));
    }

    #[test]
    fn journal_labels_match_shared_policy() {
        assert_eq!(journal_label("commit", None, None), "Commit");
        assert_eq!(journal_label("merge", Some("main"), None), "Merge main");
        assert_eq!(journal_label("merge", None, None), "Merge");
        assert_eq!(
            journal_label("cherry-pick", Some("abcdef12345"), None),
            "Cherry-pick abcdef1"
        );
        assert_eq!(
            journal_label("create-branch", None, Some("feat")),
            "Create branch feat"
        );
        assert_eq!(journal_label("stage", Some("a.ts"), None), "Stage a.ts");
        assert_eq!(journal_label("weird-kind", None, None), "weird-kind");
    }

    #[test]
    fn capture_table_matches_shared_policy() {
        assert_eq!(journal_capture_for("stage"), Some(JournalCapture::Index));
        assert_eq!(journal_capture_for("merge"), Some(JournalCapture::Head));
        assert_eq!(journal_capture_for("push"), None);
        assert_eq!(journal_capture_for("refresh"), None);
        assert!(is_journalable_action("commit"));
        assert!(!is_journalable_action("push"));
    }

    #[test]
    fn undo_redo_safety_flags() {
        let mut state = RepoState {
            detached_head: false,
            merging: true,
            rebasing: false,
            cherry_picking: false,
            reverting: false,
            bisecting: false,
            operation_label: None,
        };
        assert!(!is_undo_redo_safe(&state));
        state.merging = false;
        assert!(is_undo_redo_safe(&state));
    }

    #[test]
    fn rebase_bundle_writes_todo_and_cleans_up() {
        let dir = {
            let bundle = create_rebase_editor_bundle(&[
                (
                    "pick".to_string(),
                    "abc123".to_string(),
                    "first".to_string(),
                    None,
                ),
                (
                    "reword".to_string(),
                    "def456".to_string(),
                    "second".to_string(),
                    Some("Better title".to_string()),
                ),
            ])
            .expect("bundle");
            let todo = std::fs::read_to_string(bundle.dir.join("todo")).expect("todo file");
            assert_eq!(todo, "pick abc123 first\nreword def456 second\n");
            assert!(bundle.dir.join("msgs").join("msg-0").exists());
            assert_eq!(bundle.env.len(), 2);
            bundle.dir.clone()
        };
        assert!(!dir.exists(), "bundle dir must be cleaned up on drop");
    }

    /// End-to-end proof that the Windows `.ps1` editors drive a real
    /// `git rebase -i`. Runtime-gated (not `#[cfg]`) so it type-checks on
    /// every platform; it only executes on Windows CI.
    #[tokio::test]
    async fn windows_rebase_bundle_drives_real_rebase() {
        if !cfg!(target_os = "windows") {
            return;
        }
        let (_dir, cwd) = init_repo().await;
        let run = |args: Vec<String>| run_git(&cwd, args, RunOptions::default(), None, None);
        std::fs::write(cwd.join("b.txt"), "two\n").unwrap();
        run(vec!["add".into(), "-A".into()]).await.expect("add");
        run(vec!["commit".into(), "-m".into(), "second".into()])
            .await
            .expect("commit");
        let log = run(vec!["log".into(), "--reverse".into(), "--format=%H".into()])
            .await
            .expect("log");
        let shas: Vec<&str> = log.stdout.lines().collect();
        assert_eq!(shas.len(), 2, "unexpected log: {}", log.stdout);
        let bundle = create_rebase_editor_bundle(&[
            (
                "pick".to_string(),
                shas[1].to_string(),
                "second".to_string(),
                None,
            ),
            (
                "pick".to_string(),
                shas[0].to_string(),
                "first".to_string(),
                None,
            ),
        ])
        .expect("bundle");
        // `allow_failure` keeps the full stdout/stderr for diagnosis;
        // the exit-code assertion below preserves the test's strength.
        let result = run_git(
            &cwd,
            vec!["rebase".into(), "-i".into(), "--root".into()],
            RunOptions {
                extra_env: bundle.env.clone(),
                allow_failure: true,
                ..RunOptions::default()
            },
            None,
            None,
        )
        .await
        .expect("spawn rebase");
        if result.exit_code != Some(0) {
            eprintln!(
                "rebase bundle failed: dir={} env={:?} exit={:?} stdout={:?} stderr={:?}",
                bundle.dir.display(),
                bundle.env,
                result.exit_code,
                result.stdout,
                result.stderr
            );
        }
        drop(bundle);
        assert_eq!(result.exit_code, Some(0), "rebase driven by .ps1 editors");
        let log = run(vec!["log".into(), "--format=%s".into()])
            .await
            .expect("log");
        assert_eq!(
            log.stdout.lines().collect::<Vec<_>>(),
            vec!["first", "second"]
        );
    }

    fn null_meta() -> serde_json::Value {
        serde_json::Value::Null
    }

    async fn init_repo() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().expect("tempdir");
        let cwd = dir.path().to_path_buf();
        let run = |args: Vec<String>| run_git(&cwd, args, RunOptions::default(), None, None);
        run(vec!["init".into(), "-b".into(), "main".into()])
            .await
            .expect("init");
        run(vec!["config".into(), "user.email".into(), "t@t".into()])
            .await
            .expect("config");
        run(vec!["config".into(), "user.name".into(), "t".into()])
            .await
            .expect("config");
        // Deterministic LF checkouts: Windows runners default to
        // `core.autocrlf=true`, which would check out `a.txt` as CRLF and
        // break exact-content assertions below.
        run(vec![
            "config".into(),
            "core.autocrlf".into(),
            "false".into(),
        ])
        .await
        .expect("config");
        std::fs::write(cwd.join("a.txt"), "one\n").unwrap();
        run(vec!["add".into(), "-A".into()]).await.expect("add");
        run(vec!["commit".into(), "-m".into(), "first".into()])
            .await
            .expect("commit");
        (dir, cwd)
    }

    struct Harness {
        _dir: tempfile::TempDir,
        cwd: PathBuf,
        journal: tokio::sync::Mutex<Journal>,
        ops: tokio::sync::Mutex<Operations>,
    }

    impl Harness {
        async fn new() -> Self {
            let (dir, cwd) = init_repo().await;
            Self {
                _dir: dir,
                cwd,
                journal: tokio::sync::Mutex::new(Journal::default()),
                ops: tokio::sync::Mutex::new(Operations::default()),
            }
        }

        fn git_dir(&self) -> PathBuf {
            self.cwd.join(".git")
        }

        async fn exec(
            &self,
            kind: &str,
            target: Option<&str>,
            meta: &serde_json::Value,
        ) -> ActionEnvelope {
            let emit = |_: &str, _: Option<u32>, _: bool| {};
            execute_action(
                &"test-op".to_string(),
                &self.cwd,
                &self.git_dir(),
                kind,
                target,
                meta,
                &self.journal,
                &self.ops,
                &emit,
            )
            .await
        }

        async fn head(&self) -> String {
            let (ok, out) = probe(&self.cwd, &["rev-parse", "HEAD"]).await;
            assert!(ok);
            out.trim().to_string()
        }
    }

    #[tokio::test]
    async fn stages_and_commits_a_file() {
        let h = Harness::new().await;
        std::fs::write(h.cwd.join("b.txt"), "two\n").unwrap();
        let env = h.exec("stage", Some("b.txt"), &null_meta()).await;
        assert!(env.ok, "{}", env.message);
        let env = h
            .exec("commit", None, &serde_json::json!({ "message": "second" }))
            .await;
        assert!(env.ok, "{}", env.message);
        let (ok, log) = probe(&h.cwd, &["log", "--oneline"]).await;
        assert!(ok && log.contains("second"));
        // Undo restores the pre-commit HEAD.
        let before_undo = h.head().await;
        let env = h.exec("undo", None, &null_meta()).await;
        assert!(env.ok, "{}", env.message);
        assert_ne!(h.head().await, before_undo);
    }

    #[tokio::test]
    async fn manages_branches() {
        let h = Harness::new().await;
        let env = h
            .exec(
                "create-branch",
                None,
                &serde_json::json!({ "name": "feat" }),
            )
            .await;
        assert!(env.ok, "{}", env.message);
        let env = h.exec("checkout", Some("main"), &null_meta()).await;
        assert!(env.ok, "{}", env.message);
        let env = h.exec("delete-branch", Some("feat"), &null_meta()).await;
        assert!(env.ok, "{}", env.message);
        let env = h
            .exec("create-tag", None, &serde_json::json!({ "name": "v1" }))
            .await;
        assert!(env.ok, "{}", env.message);
        let env = h.exec("delete-tag", Some("v1"), &null_meta()).await;
        assert!(env.ok, "{}", env.message);
    }

    #[tokio::test]
    async fn stash_roundtrip_and_reset_undo() {
        let h = Harness::new().await;
        std::fs::write(h.cwd.join("a.txt"), "modified\n").unwrap();
        let env = h
            .exec("stash", None, &serde_json::json!({ "message": "wip" }))
            .await;
        assert!(env.ok, "{}", env.message);
        assert_eq!(
            std::fs::read_to_string(h.cwd.join("a.txt")).unwrap(),
            "one\n"
        );
        let env = h.exec("pop-stash", None, &null_meta()).await;
        assert!(env.ok, "{}", env.message);
        assert_eq!(
            std::fs::read_to_string(h.cwd.join("a.txt")).unwrap(),
            "modified\n"
        );

        // Commit the change, reset away, then undo/redo the reset.
        std::fs::write(h.cwd.join("a.txt"), "modified\n").unwrap();
        h.exec("stage-all", None, &null_meta()).await;
        let env = h
            .exec("commit", None, &serde_json::json!({ "message": "second" }))
            .await;
        assert!(env.ok, "{}", env.message);
        let env = h.exec("reset-hard", Some("HEAD~1"), &null_meta()).await;
        assert!(env.ok, "{}", env.message);
        assert_eq!(
            std::fs::read_to_string(h.cwd.join("a.txt")).unwrap(),
            "one\n"
        );
        let env = h.exec("undo", None, &null_meta()).await;
        assert!(env.ok, "{}", env.message);
        assert_eq!(
            std::fs::read_to_string(h.cwd.join("a.txt")).unwrap(),
            "modified\n"
        );
        let env = h.exec("redo", None, &null_meta()).await;
        assert!(env.ok, "{}", env.message);
        assert_eq!(
            std::fs::read_to_string(h.cwd.join("a.txt")).unwrap(),
            "one\n"
        );
    }

    #[tokio::test]
    async fn merges_fast_forward_and_rejects_unknown() {
        let h = Harness::new().await;
        h.exec(
            "create-branch",
            None,
            &serde_json::json!({ "name": "side" }),
        )
        .await;
        std::fs::write(h.cwd.join("c.txt"), "c\n").unwrap();
        h.exec("stage-all", None, &null_meta()).await;
        h.exec(
            "commit",
            None,
            &serde_json::json!({ "message": "side work" }),
        )
        .await;
        h.exec("checkout", Some("main"), &null_meta()).await;
        let env = h.exec("merge", Some("side"), &null_meta()).await;
        assert!(env.ok, "{}", env.message);
        assert!(h.cwd.join("c.txt").exists());

        let env = h.exec("no-such-kind", None, &null_meta()).await;
        assert!(!env.ok);
        assert!(env.message.contains("Unsupported action"));

        let env = h
            .exec("commit", None, &serde_json::json!({ "message": "   " }))
            .await;
        assert!(!env.ok);
        assert_eq!(env.error.unwrap().code, "NothingToCommit");
    }

    #[tokio::test]
    async fn discards_untracked_file_from_disk() {
        let h = Harness::new().await;
        std::fs::write(h.cwd.join("junk.txt"), "x\n").unwrap();
        let env = h.exec("discard-file", Some("junk.txt"), &null_meta()).await;
        assert!(env.ok, "{}", env.message);
        assert!(!h.cwd.join("junk.txt").exists());
    }

    #[tokio::test]
    async fn undo_without_history_fails_cleanly() {
        let h = Harness::new().await;
        let env = h.exec("undo", None, &null_meta()).await;
        assert!(!env.ok);
        assert!(env.message.contains("Nothing to undo"));
    }

    #[tokio::test]
    async fn operations_registry_cancels() {
        let mut ops = Operations::default();
        let rx = ops.register("op-1");
        // Dropping via cancel_all closes the channel.
        assert_eq!(ops.cancel_all(), 1);
        let mut rx = rx;
        assert!(rx.changed().await.is_err());
        assert_eq!(ops.cancel_all(), 0);
    }
}
