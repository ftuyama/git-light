use std::path::Path;

use crate::git::{
    BlameResult, ConflictBlock, ConflictResult, ConflictVersions, DiffHunk, DiffLine, DiffLineType,
    DiffResult, FileHistoryEntry, FileHistoryResult, GitError, RebaseCommitEntry,
    RebaseCommitsResult, SearchCommitHit, SearchResults, WireBlameLine, WireWorkingTreeFile,
};
use crate::refs::parse_numstat;

pub const REBASE_LOG_FORMAT: &str = "%H\x1f%h\x1f%s\x1f%an\x1f%at\x1e";

const EXTENSION_MAP: &[(&str, &str)] = &[
    ("ts", "typescript"),
    ("tsx", "typescript"),
    ("mts", "typescript"),
    ("cts", "typescript"),
    ("js", "javascript"),
    ("jsx", "javascript"),
    ("mjs", "javascript"),
    ("cjs", "javascript"),
    ("rb", "ruby"),
    ("rake", "ruby"),
    ("gemspec", "ruby"),
    ("erb", "ruby"),
    ("vue", "vue"),
    ("css", "css"),
    ("scss", "css"),
    ("json", "json"),
    ("md", "markdown"),
    ("py", "python"),
    ("rs", "rust"),
    ("go", "go"),
    ("java", "java"),
    ("html", "html"),
    ("htm", "html"),
    ("xml", "xml"),
    ("yml", "yaml"),
    ("yaml", "yaml"),
    ("sh", "bash"),
    ("sql", "sql"),
];

/// Mirrors `guessLanguage` in `shared/diff/guessLanguage.ts`.
pub fn guess_language(path: &str) -> String {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    // TS `path.split('.').pop()` on extensionless names returns the whole
    // name, which then misses the map → plaintext. Same outcome here.
    for (key, lang) in EXTENSION_MAP {
        if *key == ext {
            return lang.to_string();
        }
    }
    "plaintext".to_string()
}

/// Reject relative paths escaping the repo root (mirrors `pathUtils`).
pub fn assert_path_inside_repo(repo_root: &str, relative_path: &str) -> Result<String, GitError> {
    // TS strips a single leading `./` before normalizing.
    let stripped = relative_path.strip_prefix("./").unwrap_or(relative_path);
    if stripped.starts_with('/') {
        // Absolute paths resolve outside the root (unless coincidentally
        // inside — rejected here like the TS `resolve` + prefix check).
        return Err(GitError::new(
            "Unknown",
            "Path escapes the repository root.".to_string(),
        ));
    }
    let mut parts: Vec<&str> = Vec::new();
    let mut escaped = false;
    for part in stripped.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                if parts.pop().is_none() {
                    escaped = true;
                }
            }
            _ => parts.push(part),
        }
    }
    let normalized = parts.join("/");
    if escaped || normalized == ".." || normalized.starts_with("../") {
        return Err(GitError::new(
            "Unknown",
            "Path escapes the repository root.".to_string(),
        ));
    }
    let root = repo_root.trim_end_matches('/');
    let full = if normalized.is_empty() {
        root.to_string()
    } else {
        format!("{root}/{normalized}")
    };
    if full != root && !full.starts_with(&format!("{root}/")) {
        return Err(GitError::new(
            "Unknown",
            "Path escapes the repository root.".to_string(),
        ));
    }
    Ok(normalized)
}

/// Parses unified diff output into structured hunks (mirrors `diffParser`).
pub fn parse_unified_diff(path: &str, raw: &str) -> DiffResult {
    let empty = || DiffResult {
        path: path.to_string(),
        old_path: None,
        binary: false,
        too_large: false,
        language: guess_language(path),
        hunks: Vec::new(),
        additions: 0,
        deletions: 0,
    };
    if raw.trim().is_empty() {
        return empty();
    }
    if raw
        .lines()
        .any(|l| l.starts_with("Binary files ") || l.starts_with("GIT binary patch"))
    {
        let mut result = empty();
        result.binary = true;
        return result;
    }

    let lines: Vec<&str> = raw.split('\n').collect();
    let mut hunks: Vec<DiffHunk> = Vec::new();
    let mut current: Option<DiffHunk> = None;
    let mut old_line: u32 = 0;
    let mut new_line: u32 = 0;
    let mut additions: u32 = 0;
    let mut deletions: u32 = 0;
    let mut old_path: Option<String> = None;

    let line_entry =
        |t: DiffLineType, content: String, old: Option<u32>, new: Option<u32>| DiffLine {
            line_type: t,
            content,
            old_line: old,
            new_line: new,
        };

    for (idx, raw_line) in lines.iter().enumerate() {
        let line = raw_line.strip_suffix('\r').unwrap_or(raw_line);
        let is_last = idx == lines.len() - 1;
        if line.starts_with("+++ ") {
            continue;
        }
        if let Some(stripped) = line.strip_prefix("--- ") {
            let p = stripped.trim();
            if let Some(rest) = p.strip_prefix("a/") {
                old_path = Some(rest.to_string());
            } else if p != "/dev/null" {
                old_path = Some(p.to_string());
            }
            continue;
        }
        if let Some((o_start, o_lines, n_start, n_lines)) = parse_hunk_header(line) {
            if let Some(done) = current.take() {
                hunks.push(done);
            }
            old_line = o_start;
            new_line = n_start;
            current = Some(DiffHunk {
                header: line.to_string(),
                old_start: o_start,
                old_lines: o_lines,
                new_start: n_start,
                new_lines: n_lines,
                lines: Vec::new(),
            });
            continue;
        }
        // Combined diff (merge) headers use `@@@`; skip without losing the file.
        if line.starts_with("@@@") {
            continue;
        }
        let Some(hunk) = current.as_mut() else {
            continue;
        };
        if line.starts_with('+') && !line.starts_with("+++") {
            let n = new_line;
            new_line += 1;
            hunk.lines.push(line_entry(
                DiffLineType::Add,
                line[1..].to_string(),
                None,
                Some(n),
            ));
            additions += 1;
        } else if line.starts_with('-') && !line.starts_with("---") {
            let n = old_line;
            old_line += 1;
            hunk.lines.push(line_entry(
                DiffLineType::Del,
                line[1..].to_string(),
                Some(n),
                None,
            ));
            deletions += 1;
        } else if line.starts_with(' ') || (line.is_empty() && !is_last) {
            let (o, n) = (old_line, new_line);
            old_line += 1;
            new_line += 1;
            hunk.lines.push(line_entry(
                DiffLineType::Context,
                line[1..].to_string(),
                Some(o),
                Some(n),
            ));
        } else if line.starts_with('\\') {
            hunk.lines
                .push(line_entry(DiffLineType::Meta, line.to_string(), None, None));
        }
    }

    if let Some(done) = current {
        hunks.push(done);
    }
    DiffResult {
        path: path.to_string(),
        old_path,
        binary: false,
        too_large: false,
        language: guess_language(path),
        hunks,
        additions,
        deletions,
    }
}

/// `@@ -old[,count] +new[,count] @@...` — counts default to 1 like the TS regex.
fn parse_hunk_header(line: &str) -> Option<(u32, u32, u32, u32)> {
    let rest = line.strip_prefix("@@ ")?;
    let (ranges, _trailing) = rest.split_once(" @@")?;
    let mut parts = ranges.split_whitespace();
    let old = parts.next()?.strip_prefix('-')?;
    let new = parts.next()?.strip_prefix('+')?;
    if parts.next().is_some() {
        return None;
    }
    let (old_start, old_lines) = parse_range(old)?;
    let (new_start, new_lines) = parse_range(new)?;
    Some((old_start, old_lines, new_start, new_lines))
}

fn parse_range(s: &str) -> Option<(u32, u32)> {
    let (start, count) = match s.split_once(',') {
        Some((a, b)) => (a, Some(b)),
        None => (s, None),
    };
    let start: u32 = start.parse().ok()?;
    let count: u32 = match count {
        Some(c) => c.parse().ok()?,
        None => 1,
    };
    Some((start, count))
}

/// Parses `git blame --line-porcelain` (mirrors `blameParser`).
pub fn parse_blame_porcelain(stdout: &str) -> Vec<WireBlameLine> {
    let mut lines = Vec::new();
    let raw_lines: Vec<&str> = stdout.split('\n').collect();
    let mut i = 0;
    while i < raw_lines.len() {
        let header = raw_lines[i];
        if header.is_empty() {
            i += 1;
            continue;
        }
        let Some((sha, line_number)) = parse_blame_header(header) else {
            i += 1;
            continue;
        };
        i += 1;

        let (mut author, mut author_email, mut author_time, mut summary, mut content) =
            (String::new(), String::new(), 0i64, None, String::new());
        while i < raw_lines.len() {
            let line = raw_lines[i];
            if let Some(rest) = line.strip_prefix('\t') {
                content = rest.to_string();
                i += 1;
                break;
            }
            if let Some(rest) = line.strip_prefix("author ") {
                author = rest.to_string();
            } else if let Some(rest) = line.strip_prefix("author-mail ") {
                author_email = rest.to_string();
            } else if let Some(rest) = line.strip_prefix("author-time ") {
                author_time = rest.trim().parse().unwrap_or(0);
            } else if let Some(rest) = line.strip_prefix("summary ") {
                summary = Some(rest.to_string());
            }
            i += 1;
        }
        lines.push(WireBlameLine {
            line_number,
            short_sha: sha.chars().take(7).collect(),
            commit_sha: sha,
            author,
            author_email,
            author_time,
            summary,
            content,
        });
    }
    lines
}

/// `^?<sha4..40> <orig> <final> [group]` — mirrors the TS header regex.
fn parse_blame_header(header: &str) -> Option<(String, u32)> {
    let header = header.strip_prefix('^').unwrap_or(header);
    let mut parts = header.split_whitespace();
    let sha = parts.next()?;
    if !(4..=40).contains(&sha.len()) || !sha.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    parts.next()?;
    let line_number: u32 = parts.next()?.parse().ok()?;
    Some((sha.to_string(), line_number))
}

/// Parses `git log --follow` file history (mirrors `fileHistoryParser`).
pub fn parse_file_history(stdout: &str) -> Vec<FileHistoryEntry> {
    let mut entries = Vec::new();
    for line in stdout.split('\n') {
        if line.is_empty() {
            continue;
        }
        let cleaned = line.strip_suffix('\r').unwrap_or(line);
        let mut fields = cleaned.split('\x1f');
        let (sha, subject, author, at) = (
            fields.next().unwrap_or(""),
            fields.next(),
            fields.next(),
            fields.next(),
        );
        if sha.is_empty() {
            continue;
        }
        let Ok(timestamp) = at.unwrap_or("").parse::<i64>() else {
            continue;
        };
        entries.push(FileHistoryEntry {
            sha: sha.to_string(),
            short_sha: sha.chars().take(7).collect(),
            subject: subject.unwrap_or("").to_string(),
            author: author.unwrap_or("").to_string(),
            date: chrono::DateTime::from_timestamp(timestamp, 0)
                .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        });
    }
    entries
}

pub struct ConflictParse {
    pub blocks: Vec<ConflictBlock>,
    pub has_markers: bool,
}

/// Replace one conflict block with the chosen side (mirrors
/// `applyConflictResolution` in `conflictParser.ts`).
pub fn apply_conflict_resolution(
    content: &str,
    block_index: usize,
    side: &str,
) -> Result<String, GitError> {
    use crate::git::GitError;
    let parsed = parse_conflict_markers(content);
    let block = parsed
        .blocks
        .get(block_index)
        .ok_or_else(|| GitError::unknown(format!("Conflict block {block_index} not found")))?;
    let replacement = if side == "theirs" {
        &block.theirs
    } else {
        &block.ours
    };
    let lines: Vec<&str> = content.split('\n').collect();
    let mut out: Vec<&str> = Vec::new();
    out.extend_from_slice(&lines[..block.start_line as usize - 1]);
    let new_lines: Vec<&str> = replacement.split('\n').collect();
    out.extend(new_lines);
    out.extend_from_slice(&lines[block.end_line as usize..]);
    Ok(out.join("\n"))
}

/// Parses merge-conflict markers incl. `|||||||` base (mirrors `conflictParser`).
pub fn parse_conflict_markers(content: &str) -> ConflictParse {
    let lines: Vec<&str> = content
        .split('\n')
        .map(|l| l.strip_suffix('\r').unwrap_or(l))
        .collect();
    let mut blocks = Vec::new();
    let mut saw_marker = false;
    let mut i = 0;
    while i < lines.len() {
        let Some(rest) = lines[i].strip_prefix("<<<<<<< ") else {
            i += 1;
            continue;
        };
        if rest.is_empty() {
            i += 1;
            continue;
        }
        let start_line = (i + 1) as u32;
        let ours_label = rest.trim().to_string();
        saw_marker = true;
        i += 1;
        let mut ours_lines: Vec<&str> = Vec::new();
        let mut base: Option<String> = None;
        while i < lines.len() && !lines[i].starts_with("=======") {
            // TS requires a label after `|||||||`; a bare marker is content.
            if let Some(base_rest) = lines[i].strip_prefix("||||||| ") {
                if base_rest.is_empty() {
                    ours_lines.push(lines[i]);
                    i += 1;
                    continue;
                }
                i += 1;
                let mut base_lines: Vec<&str> = Vec::new();
                while i < lines.len() && !lines[i].starts_with("=======") {
                    base_lines.push(lines[i]);
                    i += 1;
                }
                base = Some(base_lines.join("\n"));
                break;
            }
            ours_lines.push(lines[i]);
            i += 1;
        }
        if i >= lines.len() || !lines[i].starts_with("=======") {
            break;
        }
        i += 1;
        let mut theirs_lines: Vec<&str> = Vec::new();
        while i < lines.len() && !lines[i].starts_with(">>>>>>>") {
            theirs_lines.push(lines[i]);
            i += 1;
        }
        let end_label = lines.get(i).and_then(|l| l.strip_prefix(">>>>>>> "));
        let Some(end_label) = end_label else { break };
        if end_label.is_empty() {
            break;
        }
        blocks.push(ConflictBlock {
            index: blocks.len() as u32,
            ours_label,
            theirs_label: end_label.trim().to_string(),
            ours: ours_lines.join("\n"),
            theirs: theirs_lines.join("\n"),
            base,
            start_line,
            end_line: (i + 1) as u32,
        });
        i += 1;
    }
    ConflictParse {
        blocks,
        has_markers: saw_marker,
    }
}

/// Parses the rebase todo log (mirrors `rebaseCommitsParser`).
pub fn parse_rebase_commits(stdout: &str) -> Vec<RebaseCommitEntry> {
    let mut commits = Vec::new();
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return commits;
    }
    for record in trimmed.split('\x1e') {
        let line = record.trim_matches(|c| c == '\r' || c == '\n');
        if line.is_empty() {
            continue;
        }
        let mut fields = line.split('\x1f');
        let (sha, short_sha, subject, author_name, at) = (
            fields.next().unwrap_or(""),
            fields.next().unwrap_or(""),
            fields.next(),
            fields.next(),
            fields.next(),
        );
        if sha.is_empty() || short_sha.is_empty() || subject.is_none() {
            continue;
        }
        let timestamp: i64 = at.unwrap_or("").parse().unwrap_or(0);
        // TS falls back to epoch only when the timestamp is not finite;
        // a missing/unparsable timestamp parses as NaN → epoch. Same here.
        let date = chrono::DateTime::from_timestamp(timestamp, 0)
            .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
            .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string());
        commits.push(RebaseCommitEntry {
            sha: sha.to_string(),
            short_sha: short_sha.to_string(),
            subject: subject.unwrap_or("").to_string(),
            author_name: author_name.unwrap_or("").to_string(),
            date,
        });
    }
    commits
}

/// Parses `git diff-tree --name-status -z` into commit file rows.
pub fn parse_commit_files(
    name_status_stdout: &str,
    numstat_stdout: &str,
) -> Vec<WireWorkingTreeFile> {
    use crate::git::WireFileStatus;
    use crate::refs::map_code;
    let numstat = parse_numstat(numstat_stdout);
    let mut files = Vec::new();
    let mut id: u32 = 0;
    let tokens: Vec<&str> = name_status_stdout
        .split('\0')
        .filter(|t| !t.is_empty())
        .collect();
    let mut i = 0;
    while i < tokens.len() {
        let status_token = tokens[i];
        i += 1;
        let status = map_code(status_token.chars().next().unwrap_or('M'));
        let (path, old_path) =
            if status == WireFileStatus::Renamed || status == WireFileStatus::Copied {
                let old = tokens.get(i).copied().unwrap_or("");
                i += 1;
                let new = tokens.get(i).copied().unwrap_or(old);
                i += 1;
                (
                    new.to_string(),
                    if old.is_empty() {
                        None
                    } else {
                        Some(old.to_string())
                    },
                )
            } else {
                let p = tokens.get(i).copied().unwrap_or("");
                i += 1;
                (p.to_string(), None)
            };
        if path.is_empty() {
            continue;
        }
        let (file_name, directory) = match path.rfind('/') {
            None => (path.clone(), String::new()),
            Some(idx) => (path[idx + 1..].to_string(), path[..idx].to_string()),
        };
        let (additions, deletions) = numstat
            .get(&path)
            .map(|c| (c.additions, c.deletions))
            .unwrap_or((0, 0));
        if let Some(existing) = files
            .iter_mut()
            .find(|f: &&mut WireWorkingTreeFile| f.path == path)
        {
            existing.additions = existing.additions.max(additions);
            existing.deletions = existing.deletions.max(deletions);
            if existing.old_path.is_none() {
                existing.old_path = old_path;
            }
            continue;
        }
        files.push(WireWorkingTreeFile {
            id: format!("commit-{id}"),
            path,
            file_name,
            directory,
            status,
            staged: false,
            additions,
            deletions,
            old_path,
            is_submodule: None,
        });
        id += 1;
    }
    files
}

#[derive(Debug, Clone, PartialEq)]
pub enum DiffSource {
    Worktree,
    Index,
    Commit,
    Range,
}

pub struct DiffFetch {
    pub source: DiffSource,
    pub path: String,
    pub sha: Option<String>,
    pub to_sha: Option<String>,
    pub ignore_whitespace: bool,
}

pub async fn fetch_diff(cwd: &Path, req: &DiffFetch) -> Result<DiffResult, GitError> {
    use crate::git::git_text;
    let safe_path = assert_path_inside_repo(&cwd.to_string_lossy(), &req.path)?;

    // Mirror the 512 KiB guard (worktree files only; TS checks the FS file).
    if req.source == DiffSource::Worktree {
        if let Ok(meta) = std::fs::metadata(cwd.join(&safe_path)) {
            if meta.len() > 512 * 1024 && !req.ignore_whitespace {
                let mut result = parse_unified_diff(&safe_path, "");
                result.too_large = true;
                return Ok(result);
            }
        }
    }

    let args: Vec<String> = match req.source {
        DiffSource::Index => vec![
            "diff".into(),
            "--cached".into(),
            "--".into(),
            safe_path.clone(),
        ],
        DiffSource::Commit => {
            let sha = req.sha.clone().unwrap_or_else(|| "HEAD".to_string());
            let parents = commit_parents(cwd, &sha).await?;
            if parents.len() > 1 {
                vec![
                    "diff".into(),
                    "-m".into(),
                    "--first-parent".into(),
                    format!("{}^1", sha),
                    sha,
                    "--".into(),
                    safe_path.clone(),
                ]
            } else if parents.len() == 1 {
                vec![
                    "diff".into(),
                    format!("{}^", sha),
                    sha,
                    "--".into(),
                    safe_path.clone(),
                ]
            } else {
                vec!["show".into(), sha, "--".into(), safe_path.clone()]
            }
        }
        DiffSource::Range => vec![
            "diff".into(),
            req.sha.clone().unwrap_or_else(|| "HEAD~1".to_string()),
            req.to_sha.clone().unwrap_or_else(|| "HEAD".to_string()),
            "--".into(),
            safe_path.clone(),
        ],
        DiffSource::Worktree => {
            ensure_intent_to_add(cwd, &safe_path).await;
            vec!["diff".into(), "--".into(), safe_path.clone()]
        }
    };
    let mut args: Vec<String> = args;
    if req.ignore_whitespace {
        args.insert(1, "-w".to_string());
    }
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let (_, stdout, _) = git_text(cwd, &arg_refs).await?;
    Ok(parse_unified_diff(&safe_path, &stdout))
}

async fn commit_parents(cwd: &Path, sha: &str) -> Result<Vec<String>, GitError> {
    use crate::git::git_text;
    let (ok, stdout, _) = git_text(cwd, &["rev-list", "--parents", "-n", "1", sha]).await?;
    if !ok {
        return Ok(Vec::new());
    }
    let parts: Vec<&str> = stdout.split_whitespace().collect();
    Ok(parts.into_iter().skip(1).map(str::to_string).collect())
}

/// Intent-to-add so untracked files appear in `git diff` (mirrors provider).
async fn ensure_intent_to_add(cwd: &Path, path: &str) {
    use crate::git::git_text;
    let tracked = git_text(cwd, &["ls-files", "--error-unmatch", "--", path]).await;
    if matches!(tracked, Ok((true, _, _))) {
        return;
    }
    let _ = git_text(cwd, &["add", "-N", "--", path]).await;
}

pub async fn fetch_blame(
    cwd: &Path,
    source: &DiffSource,
    path: &str,
    sha: Option<&str>,
    to_sha: Option<&str>,
) -> Result<BlameResult, GitError> {
    use crate::git::git_text;
    let safe_path = assert_path_inside_repo(&cwd.to_string_lossy(), path)?;
    let (head, middle) = match source {
        DiffSource::Index => (
            vec![
                "blame".to_string(),
                "--line-porcelain".to_string(),
                "--cached".to_string(),
            ],
            None,
        ),
        DiffSource::Commit => {
            let sha = sha.unwrap_or("HEAD").to_string();
            (
                vec!["blame".to_string(), "--line-porcelain".to_string()],
                Some(sha),
            )
        }
        DiffSource::Range => {
            let sha = to_sha.or(sha).unwrap_or("HEAD").to_string();
            (
                vec!["blame".to_string(), "--line-porcelain".to_string()],
                Some(sha),
            )
        }
        DiffSource::Worktree => (
            vec!["blame".to_string(), "--line-porcelain".to_string()],
            None,
        ),
    };
    let mut args = head;
    if let Some(rev) = middle {
        args.push(rev);
    }
    args.push("--".to_string());
    args.push(safe_path.clone());
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let (_, stdout, _) = git_text(cwd, &arg_refs).await?;
    Ok(BlameResult {
        path: safe_path.clone(),
        language: guess_language(&safe_path),
        lines: parse_blame_porcelain(&stdout),
    })
}

pub async fn fetch_file_history(
    cwd: &Path,
    path: &str,
    limit: usize,
) -> Result<FileHistoryResult, GitError> {
    use crate::git::git_text;
    let safe_path = assert_path_inside_repo(&cwd.to_string_lossy(), path)?;
    let limit_str = limit.to_string();
    let (_, stdout, _) = git_text(
        cwd,
        &[
            "log",
            "--follow",
            "--format=%H\x1f%s\x1f%an\x1f%at",
            "-n",
            &limit_str,
            "--",
            &safe_path,
        ],
    )
    .await?;
    Ok(FileHistoryResult {
        path: safe_path,
        entries: parse_file_history(&stdout),
    })
}

fn empty_conflict(path: &str, binary: bool) -> ConflictResult {
    ConflictResult {
        path: path.to_string(),
        binary,
        has_markers: false,
        blocks: Vec::new(),
        versions: ConflictVersions {
            base: None,
            ours: None,
            theirs: None,
        },
    }
}

async fn read_stage_version(cwd: &Path, stage: u8, path: &str) -> Option<String> {
    use crate::git::git_text;
    let spec = format!(":{stage}:{path}");
    match git_text(cwd, &["show", &spec]).await {
        Ok((true, stdout, _)) if !stdout.is_empty() => Some(stdout),
        _ => None,
    }
}

pub async fn fetch_conflict(cwd: &Path, path: &str) -> Result<ConflictResult, GitError> {
    let safe_path = assert_path_inside_repo(&cwd.to_string_lossy(), path)?;
    let full = cwd.join(&safe_path);
    match std::fs::metadata(&full) {
        Ok(meta) if meta.len() > 512 * 1024 => return Ok(empty_conflict(&safe_path, true)),
        Err(_) => return Ok(empty_conflict(&safe_path, false)),
        _ => {}
    }
    let content = match std::fs::read_to_string(&full) {
        Ok(c) => c,
        Err(_) => return Ok(empty_conflict(&safe_path, false)),
    };
    if content.contains('\0') {
        return Ok(empty_conflict(&safe_path, true));
    }
    let parsed = parse_conflict_markers(&content);
    let (base, ours, theirs) = tokio::join!(
        read_stage_version(cwd, 1, &safe_path),
        read_stage_version(cwd, 2, &safe_path),
        read_stage_version(cwd, 3, &safe_path),
    );
    Ok(ConflictResult {
        path: safe_path,
        binary: false,
        has_markers: parsed.has_markers,
        blocks: parsed.blocks,
        versions: ConflictVersions { base, ours, theirs },
    })
}

pub async fn fetch_commit_files(
    cwd: &Path,
    sha: &str,
) -> Result<Vec<WireWorkingTreeFile>, GitError> {
    use crate::git::git_text;
    let parents = commit_parents(cwd, sha).await?;
    let (tree_args, numstat_args): (Vec<String>, Vec<String>) = if parents.is_empty() {
        (
            vec![
                "diff-tree",
                "--root",
                "--no-commit-id",
                "--name-status",
                "-z",
                "-r",
                sha,
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
            vec![
                "diff-tree",
                "--root",
                "--no-commit-id",
                "--numstat",
                "-z",
                "-r",
                sha,
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
        )
    } else if parents.len() > 1 {
        // Merge: diff against the first parent only (same reference as GitKraken).
        (
            vec!["diff", "--name-status", "-z", &parents[0], sha]
                .into_iter()
                .map(|s: &str| s.to_string())
                .collect(),
            vec!["diff", "--numstat", "-z", &parents[0], sha]
                .into_iter()
                .map(|s: &str| s.to_string())
                .collect(),
        )
    } else {
        (
            vec![
                "diff-tree",
                "--no-commit-id",
                "--name-status",
                "-z",
                "-r",
                "-m",
                sha,
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
            vec![
                "diff-tree",
                "--no-commit-id",
                "--numstat",
                "-z",
                "-r",
                "-m",
                sha,
            ]
            .into_iter()
            .map(str::to_string)
            .collect(),
        )
    };
    let tree_refs: Vec<&str> = tree_args.iter().map(String::as_str).collect();
    let numstat_refs: Vec<&str> = numstat_args.iter().map(String::as_str).collect();
    let (name_status, numstat) =
        tokio::join!(git_text(cwd, &tree_refs), git_text(cwd, &numstat_refs));
    Ok(parse_commit_files(
        &name_status.unwrap_or_default().1,
        &numstat.unwrap_or_default().1,
    ))
}

pub async fn fetch_compare_files(
    cwd: &Path,
    from_sha: &str,
    to_sha: &str,
) -> Result<Vec<WireWorkingTreeFile>, GitError> {
    use crate::git::git_text;
    let tree_args = ["diff", "--name-status", "-z", from_sha, to_sha];
    let numstat_args = ["diff", "--numstat", "-z", from_sha, to_sha];
    let (name_status, numstat) =
        tokio::join!(git_text(cwd, &tree_args), git_text(cwd, &numstat_args));
    Ok(parse_commit_files(
        &name_status.unwrap_or_default().1,
        &numstat.unwrap_or_default().1,
    ))
}

pub async fn fetch_rebase_commits(cwd: &Path, base: &str) -> Result<RebaseCommitsResult, GitError> {
    use crate::git::{git_text, GitError};
    let base = base.trim();
    if base.is_empty() {
        return Err(GitError::unknown("No base ref specified.".to_string()));
    }
    let (ok, short_out, _) = git_text(cwd, &["rev-parse", "--short", base]).await?;
    if !ok {
        return Err(GitError::unknown(format!(
            "Could not resolve base ref \"{base}\"."
        )));
    }
    let range = format!("{base}..HEAD");
    let (_, stdout, _) = git_text(
        cwd,
        &[
            "log",
            "--reverse",
            &format!("--format={REBASE_LOG_FORMAT}"),
            &range,
        ],
    )
    .await?;
    let commits = parse_rebase_commits(&stdout);
    if commits.is_empty() {
        return Err(GitError::unknown(format!(
            "No commits between {base} and HEAD."
        )));
    }
    Ok(RebaseCommitsResult {
        base: base.to_string(),
        base_short_sha: short_out.trim().to_string(),
        commits,
    })
}

pub struct SearchFetch {
    pub text: String,
    pub regex: bool,
    pub limit: usize,
    pub graph_all: bool,
    pub author_field: bool,
}

pub async fn fetch_search(cwd: &Path, req: &SearchFetch) -> Result<SearchResults, GitError> {
    use crate::git::git_text;
    let text = req.text.trim();
    if text.is_empty() {
        return Ok(SearchResults {
            commits: Vec::new(),
            files: Vec::new(),
        });
    }
    let limit_str = req.limit.to_string();
    let mut args: Vec<String> = vec![
        "log".to_string(),
        "--format=%H\x1f%s\x1f%an\x1f%at".to_string(),
        "-n".to_string(),
        limit_str,
    ];
    if req.graph_all {
        args.insert(1, "--all".to_string());
    }
    let is_sha = text.len() >= 4 && text.len() <= 40 && text.chars().all(|c| c.is_ascii_hexdigit());
    if is_sha {
        args.push(text.to_string());
    } else if req.regex {
        args.push("--extended-regexp".to_string());
        args.push(format!("--grep={text}"));
    } else {
        args.push(format!("--grep={text}"));
    }
    if req.author_field {
        args.push(format!("--author={text}"));
    }
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let (_, stdout, _) = git_text(cwd, &arg_refs).await?;
    let mut commits = Vec::new();
    for line in stdout.split('\n') {
        if line.is_empty() {
            continue;
        }
        let mut fields = line.split('\x1f');
        let (sha, subject, author, at) = (
            fields.next().unwrap_or(""),
            fields.next().unwrap_or(""),
            fields.next().unwrap_or(""),
            fields.next().unwrap_or(""),
        );
        if sha.is_empty() {
            continue;
        }
        let timestamp: i64 = at.parse().unwrap_or(0);
        commits.push(SearchCommitHit {
            sha: sha.to_string(),
            short_sha: sha.chars().take(7).collect(),
            subject: subject.to_string(),
            author: author.to_string(),
            date: chrono::DateTime::from_timestamp(timestamp, 0)
                .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
                .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string()),
        });
    }
    let files = search_files(cwd, text, req.regex, req.limit).await;
    Ok(SearchResults { commits, files })
}

async fn search_files(cwd: &Path, text: &str, regex: bool, limit: usize) -> Vec<String> {
    use crate::git::git_text;
    if regex {
        let (_, stdout, _) = git_text(
            cwd,
            &["grep", "-l", "-E", "--full-name", "-e", text, "HEAD"],
        )
        .await
        .unwrap_or_default();
        return stdout
            .split('\n')
            .filter(|s| !s.is_empty())
            .take(limit)
            .map(str::to_string)
            .collect();
    }
    let from_content = git_text(cwd, &["grep", "-l", "-i", "-F", "-e", text, "HEAD"])
        .await
        .map(|(_, out, _)| out)
        .unwrap_or_default();
    let from_content: Vec<&str> = from_content.split('\n').filter(|s| !s.is_empty()).collect();
    let tracked = git_text(cwd, &["ls-files", "-z"])
        .await
        .map(|(_, out, _)| out)
        .unwrap_or_default();
    let needle = text.to_lowercase();
    let from_paths: Vec<&str> = tracked
        .split('\0')
        .filter(|f| !f.is_empty() && f.to_lowercase().contains(&needle))
        .collect();
    let mut merged: Vec<String> = Vec::new();
    for path in from_paths.into_iter().chain(from_content) {
        if !merged.iter().any(|p| p == path) {
            merged.push(path.to_string());
            if merged.len() >= limit {
                break;
            }
        }
    }
    merged
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guesses_language_by_extension() {
        assert_eq!(guess_language("src/a.ts"), "typescript");
        assert_eq!(guess_language("app.vue"), "vue");
        assert_eq!(guess_language("Makefile"), "plaintext");
        assert_eq!(guess_language("a.TS"), "typescript");
    }

    #[test]
    fn rejects_escaping_paths() {
        assert!(assert_path_inside_repo("/repo", "src/a.ts").is_ok());
        assert!(assert_path_inside_repo("/repo", "../evil").is_err());
        assert!(assert_path_inside_repo("/repo", "a/../../evil").is_err());
        assert!(assert_path_inside_repo("/repo", "./src/a.ts").is_ok());
    }

    #[test]
    fn parses_empty_diff() {
        let result = parse_unified_diff("a.ts", "  \n");
        assert!(result.hunks.is_empty());
        assert!(!result.binary);
        assert_eq!(result.language, "typescript");
    }

    #[test]
    fn detects_binary_diff() {
        let result = parse_unified_diff("img.png", "Binary files a/img.png and b/img.png differ\n");
        assert!(result.binary);
        assert!(result.hunks.is_empty());
    }

    #[test]
    fn parses_hunk_with_line_numbers() {
        let raw = "--- a/a.ts\n+++ b/a.ts\n@@ -1,3 +1,4 @@\n context\n-old\n+new\n+added\n\\ No newline at end of file\n";
        let result = parse_unified_diff("a.ts", raw);
        assert_eq!(result.hunks.len(), 1);
        let hunk = &result.hunks[0];
        assert_eq!(
            (
                hunk.old_start,
                hunk.old_lines,
                hunk.new_start,
                hunk.new_lines
            ),
            (1, 3, 1, 4)
        );
        assert_eq!(hunk.lines.len(), 5);
        assert!(matches!(hunk.lines[0].line_type, DiffLineType::Context));
        assert_eq!(
            (hunk.lines[0].old_line, hunk.lines[0].new_line),
            (Some(1), Some(1))
        );
        assert_eq!(
            (hunk.lines[1].old_line, hunk.lines[1].new_line),
            (Some(2), None)
        );
        assert_eq!(
            (hunk.lines[2].old_line, hunk.lines[2].new_line),
            (None, Some(2))
        );
        assert!(matches!(hunk.lines[4].line_type, DiffLineType::Meta));
        assert_eq!((result.additions, result.deletions), (2, 1));
        assert_eq!(result.old_path.as_deref(), Some("a.ts"));
    }

    #[test]
    fn parses_blame_porcelain() {
        let raw = "abc1234567 1 1 1\nauthor Ada\nauthor-mail <ada@x>\nauthor-time 1700000000\nsummary fix\n\tline one\n";
        let lines = parse_blame_porcelain(raw);
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].line_number, 1);
        assert_eq!(lines[0].short_sha, "abc1234");
        assert_eq!(lines[0].author, "Ada");
        assert_eq!(lines[0].content, "line one");
    }

    #[test]
    fn parses_file_history() {
        let raw = "abc123\x1fsubject\x1fAda\x1f1700000000\nbadline\n\x1f";
        let entries = parse_file_history(raw);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].date, "2023-11-14T22:13:20.000Z");
    }

    #[test]
    fn parses_conflict_with_base() {
        let content =
            "a\n<<<<<<< HEAD\nours\n||||||| base\norig\n=======\ntheirs\n>>>>>>> branch\nb\n";
        let parsed = parse_conflict_markers(content);
        assert!(parsed.has_markers);
        assert_eq!(parsed.blocks.len(), 1);
        let block = &parsed.blocks[0];
        assert_eq!((block.start_line, block.end_line), (2, 8));
        assert_eq!(block.base.as_deref(), Some("orig"));
        assert_eq!(block.ours, "ours");
        assert_eq!(block.theirs, "theirs");
    }

    #[test]
    fn unterminated_conflict_still_flags_markers() {
        let parsed = parse_conflict_markers("<<<<<<< HEAD\nours\n");
        assert!(parsed.has_markers);
        assert!(parsed.blocks.is_empty());
    }

    #[test]
    fn parses_rebase_commits() {
        let raw = "abc123\x1fabc\x1fsubject\x1fAda\x1f1700000000\x1e";
        let commits = parse_rebase_commits(raw);
        assert_eq!(commits.len(), 1);
        assert_eq!(commits[0].short_sha, "abc");
        assert_eq!(commits[0].date, "2023-11-14T22:13:20.000Z");
    }

    #[test]
    fn parses_commit_files_with_rename() {
        let name_status = "M\0src/a.ts\0R100\0old.ts\0new.ts\0";
        let numstat = "3\t1\tsrc/a.ts\0";
        let files = parse_commit_files(name_status, numstat);
        assert_eq!(files.len(), 2);
        assert_eq!(files[0].id, "commit-0");
        assert_eq!(files[0].additions, 3);
        assert_eq!(files[1].status, crate::git::WireFileStatus::Renamed);
        assert_eq!(files[1].old_path.as_deref(), Some("old.ts"));
    }

    fn fixture_repo() -> std::path::PathBuf {
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
    }

    #[tokio::test]
    async fn blames_real_file() {
        let blame = fetch_blame(
            &fixture_repo(),
            &DiffSource::Worktree,
            "package.json",
            None,
            None,
        )
        .await
        .expect("blame must work");
        assert_eq!(blame.path, "package.json");
        assert_eq!(blame.language, "json");
        assert!(!blame.lines.is_empty());
        assert!(blame.lines.iter().all(|l| l.line_number >= 1));
    }

    #[tokio::test]
    async fn histories_real_file() {
        let history = fetch_file_history(&fixture_repo(), "package.json", 5)
            .await
            .expect("history must work");
        assert!(!history.entries.is_empty());
        assert!(history.entries.len() <= 5);
        assert!(history.entries.iter().all(|e| e.sha.len() == 40));
    }

    #[tokio::test]
    async fn lists_head_commit_files() {
        let (ok, stdout, _) = crate::git::git_text(&fixture_repo(), &["rev-parse", "HEAD"])
            .await
            .unwrap();
        assert!(ok);
        let sha = stdout.trim().to_string();
        let files = fetch_commit_files(&fixture_repo(), &sha)
            .await
            .expect("commit files must work");
        assert!(!files.is_empty());
        assert!(files.iter().all(|f| !f.path.is_empty()));
    }

    #[tokio::test]
    async fn searches_by_sha_prefix() {
        let (ok, stdout, _) =
            crate::git::git_text(&fixture_repo(), &["rev-parse", "--short", "HEAD"])
                .await
                .unwrap();
        assert!(ok);
        let short = stdout.trim().to_string();
        let results = fetch_search(
            &fixture_repo(),
            &SearchFetch {
                text: short.clone(),
                regex: false,
                limit: 10,
                graph_all: true,
                author_field: false,
            },
        )
        .await
        .expect("search must work");
        assert!(results.commits.iter().any(|c| c.sha.starts_with(&short)));
    }

    #[tokio::test]
    async fn rebase_commits_rejects_empty_base() {
        let err = fetch_rebase_commits(&fixture_repo(), "  ")
            .await
            .expect_err("must fail");
        assert_eq!(err.code, "Unknown");
    }

    #[tokio::test]
    async fn conflict_on_missing_file_is_empty() {
        let result = fetch_conflict(&fixture_repo(), "does/not/exist.ts")
            .await
            .expect("must not throw");
        assert!(!result.has_markers);
        assert!(result.blocks.is_empty());
    }
}
