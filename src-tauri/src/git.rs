use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{SystemTime, UNIX_EPOCH};

/// Typed git failure. Serializes to `SerializedGitError`
/// (`shared/git/errors.ts`): codes are PascalCase to match `GitErrorCode`.
#[derive(Debug, Clone, Serialize)]
pub struct GitError {
    #[serde(rename = "__gitError")]
    marker: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files: Option<Vec<String>>,
}

impl GitError {
    pub fn new(code: &str, message: String) -> Self {
        Self {
            marker: true,
            code: code.to_string(),
            message,
            detail: None,
            files: None,
        }
    }

    pub fn unknown(message: String) -> Self {
        Self::new("Unknown", message)
    }

    pub(crate) fn classified(
        code: &str,
        message: String,
        detail: Option<String>,
        files: Option<Vec<String>>,
    ) -> Self {
        Self {
            marker: true,
            code: code.to_string(),
            message,
            detail,
            files,
        }
    }
}

#[derive(Debug)]
pub struct RepoInfo {
    pub path: PathBuf,
    pub git_dir: PathBuf,
    pub git_version: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireAuthor {
    pub name: String,
    pub email: String,
    pub avatar_url: String,
    pub initials: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoState {
    pub detached_head: bool,
    pub merging: bool,
    pub rebasing: bool,
    pub cherry_picking: bool,
    pub reverting: bool,
    pub bisecting: bool,
    pub operation_label: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireRemote {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireRepository {
    pub name: String,
    pub path: String,
    pub git_version: String,
    pub current_branch: String,
    pub detached: bool,
    pub head_sha: String,
    pub ahead: u32,
    pub behind: u32,
    pub remote_url: String,
    pub remotes: Vec<WireRemote>,
    pub state: RepoState,
    pub can_undo: bool,
    pub can_redo: bool,
    pub undo_label: Option<String>,
    pub redo_label: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitPageInfo {
    pub oldest_sha: Option<String>,
    pub has_more: bool,
    pub total: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireSnapshot {
    pub repository: WireRepository,
    pub commits: Vec<WireCommit>,
    pub page: CommitPageInfo,
    pub branches: Vec<WireBranch>,
    pub tags: Vec<WireTag>,
    pub stashes: Vec<WireStash>,
    pub worktrees: Vec<WireWorktree>,
    pub working_tree: Vec<WireWorkingTreeFile>,
    pub authors: Vec<WireAuthor>,
    pub commit_author: WireAuthor,
}

/// Mirrors `WireRefType` in `shared/git/models.ts` (values are camelCase literals).
/// `Head` is never produced by the parser (kept for wire completeness).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WireRefType {
    #[allow(dead_code)]
    Head,
    LocalBranch,
    RemoteBranch,
    Tag,
    Stash,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireRef {
    #[serde(rename = "type")]
    pub ref_type: WireRefType,
    pub name: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_head: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireCommit {
    pub sha: String,
    pub short_sha: String,
    pub parents: Vec<String>,
    pub subject: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    pub author: WireAuthor,
    pub committer: WireAuthor,
    pub date: String,
    pub refs: Vec<WireRef>,
    pub is_merge: bool,
    pub is_cherry_pick: bool,
    /// Stash base backfilled outside the loaded window (GitKraken-style
    /// anchoring). Excluded from pagination cursors, never from display.
    #[serde(default)]
    pub is_stash_base: bool,
}

/// Mirrors branch/tag/stash/worktree/status wire models in `shared/git/models.ts`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum WireBranchKind {
    Local,
    Remote,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireBranch {
    pub id: String,
    pub name: String,
    pub kind: WireBranchKind,
    pub group: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote: Option<String>,
    pub tip_sha: String,
    pub ahead: u32,
    pub behind: u32,
    pub is_current: bool,
    pub is_favorite: bool,
    pub last_activity: String,
    pub lane_color_index: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upstream: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireTag {
    pub id: String,
    pub name: String,
    pub sha: String,
    pub message: String,
    pub date: String,
    pub annotated: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireStash {
    pub id: String,
    pub index: u32,
    pub message: String,
    pub branch: String,
    pub date: String,
    pub files_changed: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_sha: Option<String>,
    /// Subject of the base commit (`git show -s --format=%s <base>`);
    /// lets the UI explain a floating stash whose base left the loaded window.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_subject: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireWorktree {
    pub id: String,
    pub path: String,
    pub branch: String,
    pub is_main: bool,
    pub is_locked: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum WireFileStatus {
    Modified,
    Added,
    Deleted,
    Renamed,
    Copied,
    Untracked,
    Ignored,
    Conflicted,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireWorkingTreeFile {
    pub id: String,
    pub path: String,
    pub file_name: String,
    pub directory: String,
    pub status: WireFileStatus,
    pub staged: bool,
    pub additions: u32,
    pub deletions: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_submodule: Option<bool>,
}

#[derive(Debug, Clone)]
pub struct NumstatEntry {
    pub additions: u32,
    pub deletions: u32,
}

/// Diff/blame/history/conflict/search wire models (`shared/git/models.ts`, `shared/git/rebase.ts`).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DiffLineType {
    Context,
    Add,
    Del,
    #[allow(dead_code)]
    Hunk,
    Meta,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    #[serde(rename = "type")]
    pub line_type: DiffLineType,
    pub content: String,
    pub old_line: Option<u32>,
    pub new_line: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    pub header: String,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffResult {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_path: Option<String>,
    pub binary: bool,
    pub too_large: bool,
    pub language: String,
    pub hunks: Vec<DiffHunk>,
    pub additions: u32,
    pub deletions: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireBlameLine {
    pub line_number: u32,
    pub commit_sha: String,
    pub short_sha: String,
    pub author: String,
    pub author_email: String,
    pub author_time: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlameResult {
    pub path: String,
    pub language: String,
    pub lines: Vec<WireBlameLine>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHistoryEntry {
    pub sha: String,
    pub short_sha: String,
    pub subject: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHistoryResult {
    pub path: String,
    pub entries: Vec<FileHistoryEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictBlock {
    pub index: u32,
    pub ours_label: String,
    pub theirs_label: String,
    pub ours: String,
    pub theirs: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base: Option<String>,
    pub start_line: u32,
    pub end_line: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictVersions {
    pub base: Option<String>,
    pub ours: Option<String>,
    pub theirs: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictResult {
    pub path: String,
    pub binary: bool,
    pub has_markers: bool,
    pub blocks: Vec<ConflictBlock>,
    pub versions: ConflictVersions,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchCommitHit {
    pub sha: String,
    pub short_sha: String,
    pub subject: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResults {
    pub commits: Vec<SearchCommitHit>,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RebaseCommitEntry {
    pub sha: String,
    pub short_sha: String,
    pub subject: String,
    pub author_name: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RebaseCommitsResult {
    pub base: String,
    pub base_short_sha: String,
    pub commits: Vec<RebaseCommitEntry>,
}

/// Mirrors `RecentRepository` in `shared/git/models.ts`.
#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentRepository {
    pub path: String,
    pub name: String,
    pub last_opened: i64,
}

/// Non-interactive child env shared by every git invocation
/// (mirrors `GitCliProvider.childEnv`).
pub fn child_env(cmd: &mut tokio::process::Command) {
    cmd.env("GIT_TERMINAL_PROMPT", "0");
    cmd.env("GIT_OPTIONAL_LOCKS", "0");
    cmd.env("LC_ALL", "C");
}

/// Spawn `git` with argv only (never through a shell).
/// Always applies the stable-output base args + non-interactive env,
/// mirroring `GitCliProvider`.
pub async fn git_text(cwd: &Path, args: &[&str]) -> Result<(bool, String, String), GitError> {
    let mut full: Vec<&str> = vec!["-c", "core.quotepath=false", "-c", "color.ui=false"];
    full.extend(args);
    let mut cmd = tokio::process::Command::new("git");
    cmd.args(&full).current_dir(cwd).stdin(Stdio::null());
    child_env(&mut cmd);
    let output = cmd
        .output()
        .await
        .map_err(|e| GitError::unknown(format!("failed to spawn git: {e}")))?;
    Ok((
        output.status.success(),
        String::from_utf8_lossy(&output.stdout).into_owned(),
        String::from_utf8_lossy(&output.stderr).into_owned(),
    ))
}

/// Spawn `git` with argv only (never through a shell) and return raw bytes.
/// Needed for binary blobs (`git show <rev>:<path>`); `git_text` would
/// corrupt them via UTF-8 lossy conversion.
pub async fn git_bytes(cwd: &Path, args: &[&str]) -> Result<(bool, Vec<u8>), GitError> {
    let mut full: Vec<&str> = vec!["-c", "core.quotepath=false", "-c", "color.ui=false"];
    full.extend(args);
    let mut cmd = tokio::process::Command::new("git");
    cmd.args(&full).current_dir(cwd).stdin(Stdio::null());
    child_env(&mut cmd);
    let output = cmd
        .output()
        .await
        .map_err(|e| GitError::unknown(format!("failed to spawn git: {e}")))?;
    Ok((output.status.success(), output.stdout))
}

/// Resolve + validate that `path` is a non-bare git working tree.
pub async fn validate_repo(path: &Path) -> Result<RepoInfo, GitError> {
    let canonical = std::fs::canonicalize(path).map_err(|_| {
        GitError::new(
            "RepositoryNotFound",
            "The repository could not be found.".to_string(),
        )
    })?;
    let (ok, stdout, _) = git_text(&canonical, &["rev-parse", "--git-dir"]).await?;
    if !ok {
        return Err(GitError::new(
            "NotARepository",
            "This folder is not a Git repository.".to_string(),
        ));
    }
    let raw = stdout.trim().to_string();
    let git_dir = if Path::new(&raw).is_absolute() {
        PathBuf::from(raw)
    } else {
        canonical.join(raw)
    };
    let (bare_ok, bare_out, _) =
        git_text(&canonical, &["rev-parse", "--is-bare-repository"]).await?;
    if bare_ok && bare_out.trim() == "true" {
        return Err(GitError::new(
            "BareRepository",
            "Bare repositories are not supported yet.".to_string(),
        ));
    }
    if !git_dir.exists() {
        return Err(GitError::new(
            "RepositoryNotFound",
            "The .git directory is missing.".to_string(),
        ));
    }
    let (_, version_out, _) = git_text(&canonical, &["--version"]).await?;
    let git_version = version_out.replace("git version ", "").trim().to_string();
    Ok(RepoInfo {
        path: canonical,
        git_dir,
        git_version,
    })
}

#[derive(Debug, Clone)]
pub struct SnapshotOptions {
    pub commit_limit: usize,
    pub graph_all: bool,
    pub with_commits: bool,
    pub with_branches: bool,
    pub with_tags: bool,
    pub with_stashes: bool,
    pub with_worktrees: bool,
    pub with_status: bool,
}

impl SnapshotOptions {
    #[cfg(test)]
    fn empty_lists() -> Self {
        Self {
            commit_limit: 100,
            graph_all: true,
            with_commits: false,
            with_branches: false,
            with_tags: false,
            with_stashes: false,
            with_worktrees: false,
            with_status: false,
        }
    }
}

/// Full snapshot: metadata + scoped lists. Absent scopes (or unknown shapes)
/// default to a full snapshot, mirroring `snapshotInner`.
pub async fn build_snapshot(
    path: &Path,
    opts: &SnapshotOptions,
    favorites: &std::collections::HashSet<String>,
) -> Result<WireSnapshot, GitError> {
    let info = validate_repo(path).await?;
    let cwd = info.path.clone();

    let (commits_out, branches_out, working_tree_out) = tokio::join!(
        async {
            if opts.with_commits {
                crate::log::fetch_commit_log(&cwd, opts.commit_limit, opts.graph_all, None, 0)
                    .await
                    .map(Some)
            } else {
                Ok(None)
            }
        },
        async {
            if opts.with_branches {
                crate::refs::fetch_branches(&cwd, favorites).await.map(Some)
            } else {
                Ok(None)
            }
        },
        async {
            if opts.with_status {
                crate::refs::fetch_working_tree(&cwd).await.map(Some)
            } else {
                Ok(None)
            }
        },
    );
    let bundle = commits_out?;
    let branches = branches_out?.unwrap_or_default();
    let working_tree = working_tree_out?.unwrap_or_default();

    let (tags, stashes, worktrees, remotes) = tokio::join!(
        async {
            if opts.with_tags {
                crate::refs::fetch_tags(&cwd).await
            } else {
                Vec::new()
            }
        },
        async {
            // Stash bases are also needed when loading commits: missing bases
            // are backfilled below so every stash anchors onto its base.
            if opts.with_stashes || opts.with_commits {
                crate::refs::fetch_stashes(&cwd).await
            } else {
                Vec::new()
            }
        },
        async {
            if opts.with_worktrees {
                crate::refs::fetch_worktrees(&cwd, &cwd).await
            } else {
                Vec::new()
            }
        },
        crate::refs::fetch_remotes(&cwd),
    );

    let (_, branch_out, _) = git_text(&cwd, &["rev-parse", "--abbrev-ref", "HEAD"]).await?;
    let branch = branch_out.trim();
    let detached = branch == "HEAD" || branch.is_empty();
    let current_branch = if detached {
        "(detached)".to_string()
    } else {
        branch.to_string()
    };
    let (head_ok, head_out, _) = git_text(&cwd, &["rev-parse", "HEAD"]).await?;
    let head_sha = if head_ok {
        head_out.trim().to_string()
    } else {
        String::new()
    };
    let (_, name_out, _) = git_text(&cwd, &["config", "user.name"]).await?;
    let (_, email_out, _) = git_text(&cwd, &["config", "user.email"]).await?;
    let (name, email) = (name_out.trim().to_string(), email_out.trim().to_string());
    let mut identity_registry = crate::log::AuthorRegistry::default();
    let commit_author = identity_registry.resolve(&name, &email);
    let remote_url = remotes
        .iter()
        .find(|r| r.name == "origin")
        .map(|r| {
            if !r.fetch_url.is_empty() {
                r.fetch_url.clone()
            } else {
                r.push_url.clone()
            }
        })
        .unwrap_or_default();
    let state = crate::refs::read_repo_state(&info.git_dir);
    let (mut commits, mut authors, page) = match bundle {
        Some(b) => (
            b.commits,
            b.authors,
            CommitPageInfo {
                oldest_sha: b.oldest_sha,
                has_more: b.has_more,
                total: None,
            },
        ),
        None => (
            Vec::new(),
            Vec::new(),
            CommitPageInfo {
                oldest_sha: None,
                has_more: false,
                total: Some(0),
            },
        ),
    };
    if opts.with_commits {
        // Backfill stash bases missing from the loaded window (orphaned by
        // amend/rebase, or deeper than the limit) so stashes anchor onto
        // their base like GitKraken instead of floating at the top.
        // `page.oldest_sha` stays the window edge, keeping pagination intact.
        let (mut bases, base_authors) =
            crate::refs::fetch_missing_stash_bases(&cwd, &commits, &stashes).await;
        if !bases.is_empty() {
            let mut known: std::collections::HashSet<String> =
                authors.iter().map(|a| a.email.to_lowercase()).collect();
            for author in base_authors {
                if known.insert(author.email.to_lowercase()) {
                    authors.push(author);
                }
            }
            commits.append(&mut bases);
        }
    }
    let snapshot_stashes = if opts.with_stashes {
        stashes
    } else {
        Vec::new()
    };
    Ok(WireSnapshot {
        repository: WireRepository {
            name: repo_name_from_path(&info.path),
            path: info.path.to_string_lossy().into_owned(),
            git_version: info.git_version,
            current_branch,
            detached,
            head_sha,
            ahead: 0,
            behind: 0,
            remote_url,
            remotes,
            state,
            can_undo: false,
            can_redo: false,
            undo_label: None,
            redo_label: None,
        },
        commits,
        page,
        branches,
        tags,
        stashes: snapshot_stashes,
        worktrees,
        working_tree,
        authors,
        commit_author,
    })
}

pub fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn repo_name_from_path(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

/// Tolerant parse of our `recent-repos.json` (invalid → empty).
pub fn parse_recent_repos(json: &str) -> Vec<RecentRepository> {
    serde_json::from_str(json).unwrap_or_default()
}

/// Merge an opened repo to the front, dedupe by path, cap at 12.
pub fn merge_recent(
    existing: Vec<RecentRepository>,
    path: &str,
    now: i64,
) -> Vec<RecentRepository> {
    let mut merged = vec![RecentRepository {
        path: path.to_string(),
        name: repo_name_from_path(Path::new(path)),
        last_opened: now,
    }];
    merged.extend(existing.into_iter().filter(|r| r.path != path));
    merged.truncate(12);
    merged
}

/// Pinned-branch names per repository.
/// Stored as `{ "<repo_path>": ["<branch>", ...] }`.
pub type FavoritesMap = std::collections::HashMap<String, Vec<String>>;

/// Tolerant parse of our `favorites.json` (invalid → empty).
pub fn parse_favorites_file(json: &str) -> FavoritesMap {
    serde_json::from_str(json).unwrap_or_default()
}

pub fn favorite_names(map: &FavoritesMap, repo_path: &str) -> Vec<String> {
    map.get(repo_path).cloned().unwrap_or_default()
}

pub fn set_favorite_names(map: &mut FavoritesMap, repo_path: &str, names: &[String]) {
    map.insert(repo_path.to_string(), names.to_vec());
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::{HashMap, HashSet};

    #[test]
    fn favorites_roundtrip_per_repo() {
        let map = parse_favorites_file(r#" {"/repo": ["main", "feat"]} "#);
        assert_eq!(
            favorite_names(&map, "/repo"),
            ["main".to_string(), "feat".to_string()]
        );
        assert!(favorite_names(&map, "/other").is_empty());
        assert!(parse_favorites_file("nope").is_empty());
    }

    #[test]
    fn favorites_set_replaces_names() {
        let mut map = HashMap::new();
        set_favorite_names(&mut map, "/repo", &["a".to_string(), "b".to_string()]);
        set_favorite_names(&mut map, "/repo", &["c".to_string()]);
        assert_eq!(favorite_names(&map, "/repo"), ["c".to_string()]);
    }

    fn fixture_repo() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
    }

    /// Hermetic repo with `main` checked out plus a `side` branch.
    /// Snapshot tests must not depend on the ambient checkout: tag builds
    /// (detached HEAD, no local branches) broke the fixture-based versions.
    async fn temp_repo() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().expect("tempdir");
        let cwd = dir.path().to_path_buf();
        for args in [
            vec!["init", "-b", "main"],
            vec!["config", "user.email", "t@t"],
            vec!["config", "user.name", "t"],
            vec!["config", "core.autocrlf", "false"],
        ] {
            let argv: Vec<&str> = args.iter().map(|s| *s).collect();
            let (ok, _, err) = git_text(&cwd, &argv).await.expect("git spawn");
            assert!(ok, "git {argv:?} failed: {err}");
        }
        std::fs::write(cwd.join("a.txt"), "one\n").unwrap();
        for args in [
            vec!["add", "-A"],
            vec!["commit", "-m", "first"],
            vec!["branch", "side"],
        ] {
            let argv: Vec<&str> = args.iter().map(|s| *s).collect();
            let (ok, _, err) = git_text(&cwd, &argv).await.expect("git spawn");
            assert!(ok, "git {argv:?} failed: {err}");
        }
        (dir, cwd)
    }

    #[tokio::test]
    async fn validates_real_repo() {
        let info = validate_repo(&fixture_repo())
            .await
            .expect("fixture must be a git repo");
        assert!(info.git_dir.ends_with(".git"));
        assert_eq!(info.path.file_name().unwrap(), "git-light");
    }

    #[tokio::test]
    async fn rejects_non_repo() {
        // `/tmp` does not exist on Windows (canonicalize fails with
        // `RepositoryNotFound`). Use a guaranteed-existing,
        // guaranteed-not-a-repo directory instead.
        let dir = tempfile::tempdir().expect("tempdir");
        let err = validate_repo(dir.path()).await.expect_err("must fail");
        assert_eq!(err.code, "NotARepository");
    }

    #[tokio::test]
    async fn rejects_missing_path() {
        let err = validate_repo(Path::new("/definitely/not/here"))
            .await
            .expect_err("must fail");
        assert_eq!(err.code, "RepositoryNotFound");
    }

    #[tokio::test]
    async fn full_snapshot_lists_branches_and_remotes() {
        let (_dir, cwd) = temp_repo().await;
        let opts = SnapshotOptions {
            commit_limit: 10,
            graph_all: true,
            with_commits: true,
            with_branches: true,
            with_tags: true,
            with_stashes: true,
            with_worktrees: true,
            with_status: true,
        };
        let snap = build_snapshot(&cwd, &opts, &std::collections::HashSet::new())
            .await
            .expect("full snapshot must work");
        assert!(!snap.commits.is_empty());
        assert!(
            snap.branches.iter().any(|b| b.is_current),
            "must flag current branch"
        );
        assert!(snap
            .repository
            .remotes
            .iter()
            .all(|r| !r.fetch_url.is_empty() || !r.push_url.is_empty()));
    }

    #[tokio::test]
    async fn snapshot_marks_favorite_branches() {
        let (_dir, cwd) = temp_repo().await;
        let favs: HashSet<String> = ["main".to_string()].into_iter().collect();
        let opts = SnapshotOptions {
            commit_limit: 1,
            graph_all: true,
            with_commits: false,
            with_branches: true,
            with_tags: false,
            with_stashes: false,
            with_worktrees: false,
            with_status: false,
        };
        let snap = build_snapshot(&cwd, &opts, &favs)
            .await
            .expect("snapshot must work");
        let main = snap
            .branches
            .iter()
            .find(|b| b.name == "main")
            .expect("main branch");
        assert!(main.is_favorite);
        assert!(snap
            .branches
            .iter()
            .filter(|b| b.name != "main")
            .all(|b| !b.is_favorite));
    }

    #[tokio::test]
    async fn minimal_snapshot_reads_head() {
        let snap = build_snapshot(
            &fixture_repo(),
            &SnapshotOptions::empty_lists(),
            &std::collections::HashSet::new(),
        )
        .await
        .expect("snapshot must work");
        assert_eq!(snap.repository.name, "git-light");
        assert_eq!(snap.repository.head_sha.len(), 40);
        assert!(!snap.repository.current_branch.is_empty());
        assert!(snap.commits.is_empty());
        assert!(snap.page.has_more == false);
    }

    #[test]
    fn recents_parse_tolerant() {
        assert!(parse_recent_repos("nope").is_empty());
        assert!(parse_recent_repos("[]").is_empty());
        let list = parse_recent_repos(r#"[{"path":"/a","name":"a","lastOpened":5}]"#);
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].last_opened, 5);
    }

    #[test]
    fn recents_merge_dedupes_and_caps() {
        let existing: Vec<RecentRepository> = (0..12)
            .map(|i| RecentRepository {
                path: format!("/r{i}"),
                name: format!("r{i}"),
                last_opened: i as i64,
            })
            .collect();
        let merged = merge_recent(existing, "/r5", 99);
        assert_eq!(merged.len(), 12);
        assert_eq!(merged[0].path, "/r5");
        assert_eq!(merged[0].last_opened, 99);
        assert_eq!(merged.iter().filter(|r| r.path == "/r5").count(), 1);
    }

    #[tokio::test]
    async fn snapshot_serializes_to_wire_camel_case() {
        let snap = build_snapshot(
            &fixture_repo(),
            &SnapshotOptions::empty_lists(),
            &std::collections::HashSet::new(),
        )
        .await
        .expect("snapshot must work");
        let v = serde_json::to_value(&snap).expect("serializable");
        let repo = &v["repository"];
        assert_eq!(repo["name"], "git-light");
        assert!(repo.get("currentBranch").is_some(), "missing currentBranch");
        assert!(repo.get("headSha").is_some(), "missing headSha");
        assert!(repo.get("gitVersion").is_some(), "missing gitVersion");
        assert!(v.get("commitAuthor").is_some(), "missing commitAuthor");
        assert!(v.get("workingTree").is_some(), "missing workingTree");
        assert!(v.get("oldestSha").is_none(), "leaked snake_case page key");
    }
}
