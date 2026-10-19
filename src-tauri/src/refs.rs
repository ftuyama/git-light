use std::collections::{HashMap, HashSet};
use std::path::Path;

use crate::git::{
    GitError, NumstatEntry, RepoState, WireAuthor, WireBranch, WireBranchKind, WireCommit,
    WireFileStatus, WireRemote, WireStash, WireTag, WireWorkingTreeFile, WireWorktree,
};
use crate::log::hash_string as hash_string_pub;

pub const BRANCH_FORMAT: &str = "%(refname)\x1f%(objectname)\x1f%(HEAD)\x1f%(upstream:short)\x1f%(upstream:track)\x1f%(committerdate:iso-strict)";
pub const BRANCH_REFSPECS: [&str; 2] = ["refs/heads", "refs/remotes"];
pub const TAG_FORMAT: &str =
    "%(refname:short)\x1f%(objectname)\x1f%(*objectname)\x1f%(objecttype)\x1f%(creatordate:iso-strict)\x1f%(contents:subject)";
pub const STASH_FORMAT: &str = "%gd\x1f%ct\x1f%gs";

pub const FIELD: char = '\x1f';

pub fn epoch_iso() -> String {
    "1970-01-01T00:00:00.000Z".to_string()
}

/// Parse a git date (`iso-strict`, possibly `+0000` without colon) to ISO millis.
pub fn parse_git_date(raw: &str) -> String {
    let s = raw.trim();
    if s.is_empty() {
        return epoch_iso();
    }
    let mut norm = s.to_string();
    // `+0000` (no colon) → `+00:00` so RFC 3339 parsing accepts both.
    if norm.len() >= 5 {
        let cut = norm.len() - 5;
        let tail = &norm.as_bytes()[cut..];
        if (tail[0] == b'+' || tail[0] == b'-') && tail[1..].iter().all(|b| b.is_ascii_digit()) {
            let head = norm[..cut].to_string();
            let tz = norm[cut..].to_string();
            norm = format!("{}{}:{}", head, &tz[..3], &tz[3..]);
        }
    }
    chrono::DateTime::parse_from_rfc3339(&norm)
        .map(|dt| {
            dt.to_utc()
                .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
        })
        .unwrap_or_else(|_| epoch_iso())
}

pub fn lane_color_index_for(name: &str) -> u32 {
    (hash_string_pub(name) as usize % 8) as u32
}

pub fn group_for(name: &str) -> String {
    match name.find('/') {
        Some(idx) => name[..idx].to_string(),
        None => String::new(),
    }
}

fn parse_ahead_behind(track: &str, keyword: &str) -> u32 {
    let mut rest = track;
    while let Some(idx) = rest.find(keyword) {
        let after = rest[idx + keyword.len()..].trim_start();
        let digits: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(n) = digits.parse::<u32>() {
            return n;
        }
        rest = after;
    }
    0
}

pub fn parse_track(track: &str) -> (u32, u32) {
    (
        parse_ahead_behind(track, "ahead "),
        parse_ahead_behind(track, "behind "),
    )
}

pub fn parse_branches(stdout: &str, favorites: &HashSet<String>) -> Vec<WireBranch> {
    let mut branches = Vec::new();
    for line_raw in stdout.split('\n') {
        let line = line_raw.trim_end_matches(['\r', '\n']);
        if line.trim().is_empty() {
            continue;
        }
        let fields: Vec<&str> = line.split(FIELD).collect();
        let get = |i: usize| fields.get(i).copied().unwrap_or("");
        let (refname, sha, head, upstream, track, date) =
            (get(0), get(1), get(2), get(3), get(4), get(5));

        if let Some(name) = refname.strip_prefix("refs/heads/") {
            let name = name.to_string();
            let (ahead, behind) = parse_track(track);
            let gone = track.contains("[gone]");
            branches.push(WireBranch {
                id: format!("local:{name}"),
                group: group_for(&name),
                tip_sha: sha.to_string(),
                is_current: head == "*",
                is_favorite: favorites.contains(&name),
                last_activity: if date.is_empty() {
                    epoch_iso()
                } else {
                    parse_git_date(date)
                },
                lane_color_index: lane_color_index_for(&name),
                upstream: if gone { None } else { none_if_empty(upstream) },
                name,
                kind: WireBranchKind::Local,
                remote: None,
                ahead,
                behind,
            });
        } else if let Some(rest) = refname.strip_prefix("refs/remotes/") {
            if rest == "HEAD" || rest.ends_with("/HEAD") {
                continue;
            }
            let (remote, name) = match rest.find('/') {
                Some(idx) => (rest[..idx].to_string(), rest[idx + 1..].to_string()),
                None => (rest.to_string(), rest.to_string()),
            };
            branches.push(WireBranch {
                id: format!("remote:{rest}"),
                group: group_for(&name),
                tip_sha: sha.to_string(),
                last_activity: if date.is_empty() {
                    epoch_iso()
                } else {
                    parse_git_date(date)
                },
                lane_color_index: lane_color_index_for(&name),
                name,
                kind: WireBranchKind::Remote,
                remote: Some(remote),
                ahead: 0,
                behind: 0,
                is_current: false,
                is_favorite: false,
                upstream: None,
            });
        }
    }
    branches
}

fn none_if_empty(s: &str) -> Option<String> {
    if s.is_empty() {
        None
    } else {
        Some(s.to_string())
    }
}

pub fn parse_tags(stdout: &str) -> Vec<WireTag> {
    let mut tags = Vec::new();
    for line_raw in stdout.split('\n') {
        let line = line_raw.trim_end_matches(['\r', '\n']);
        if line.trim().is_empty() {
            continue;
        }
        let fields: Vec<&str> = line.split(FIELD).collect();
        let get = |i: usize| fields.get(i).copied().unwrap_or("");
        let (name, object_name, deref_name, object_type, date, subject) =
            (get(0), get(1), get(2), get(3), get(4), get(5));
        let annotated = object_type == "tag";
        tags.push(WireTag {
            id: format!("tag:{name}"),
            name: name.to_string(),
            sha: if annotated && !deref_name.is_empty() {
                deref_name.to_string()
            } else {
                object_name.to_string()
            },
            message: subject.to_string(),
            date: if date.is_empty() {
                epoch_iso()
            } else {
                parse_git_date(date)
            },
            annotated,
        });
    }
    tags
}

pub fn parse_remotes(stdout: &str) -> Vec<WireRemote> {
    let mut order: Vec<String> = Vec::new();
    let mut map: HashMap<String, WireRemote> = HashMap::new();
    for line_raw in stdout.split('\n') {
        let line = line_raw.trim();
        if line.is_empty() {
            continue;
        }
        let (kind, rest) = if let Some(rest) = line.strip_suffix("(fetch)") {
            ("fetch", rest)
        } else if let Some(rest) = line.strip_suffix("(push)") {
            ("push", rest)
        } else {
            continue;
        };
        let mut parts = rest.split_whitespace();
        let (Some(name), Some(url)) = (parts.next(), parts.next()) else {
            continue;
        };
        let entry = map.entry(name.to_string()).or_insert_with(|| {
            order.push(name.to_string());
            WireRemote {
                name: name.to_string(),
                fetch_url: String::new(),
                push_url: String::new(),
            }
        });
        if kind == "fetch" {
            entry.fetch_url = url.to_string();
        } else {
            entry.push_url = url.to_string();
        }
    }
    order.into_iter().filter_map(|n| map.remove(&n)).collect()
}

pub fn parse_stashes(stdout: &str) -> Vec<WireStash> {
    let mut stashes = Vec::new();
    let mut index: u32 = 0;
    for line_raw in stdout.split('\n') {
        let line = line_raw.trim_end_matches(['\r', '\n']);
        if line.trim().is_empty() {
            continue;
        }
        let fields: Vec<&str> = line.split(FIELD).collect();
        let get = |i: usize| fields.get(i).copied().unwrap_or("");
        let (selector, ts, subject) = (get(0), get(1), get(2));
        // `%gs` looks like "WIP on main: 1a2b3c message" or "On main: message".
        let branch = extract_stash_branch(subject);
        let date = ts
            .trim()
            .parse::<i64>()
            .ok()
            .and_then(|t| chrono::DateTime::from_timestamp(t, 0))
            .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
            .unwrap_or_else(epoch_iso);
        stashes.push(WireStash {
            id: if selector.is_empty() {
                format!("stash@{{{index}}}")
            } else {
                selector.to_string()
            },
            index,
            message: subject.to_string(),
            branch,
            date,
            files_changed: 0,
            base_sha: None,
            base_subject: None,
        });
        index += 1;
    }
    stashes
}

fn extract_stash_branch(subject: &str) -> String {
    for marker in ["WIP on", "On"] {
        if let Some(rest) = subject.split_once(marker) {
            // TS `/(?:WIP on|On)\s+([^:]+):/` requires whitespace after the marker.
            let Some(after) = rest.1.strip_prefix(|c| c == ' ' || c == '\t') else {
                continue;
            };
            if let Some(colon) = after.find(':') {
                return after[..colon].trim().to_string();
            }
        }
    }
    String::new()
}

pub fn is_full_sha(s: &str) -> bool {
    s.len() == 40 && s.chars().all(|c| c.is_ascii_hexdigit())
}

fn unquote_path(p: &str) -> String {
    if p.len() >= 2 && p.starts_with('"') && p.ends_with('"') {
        let inner = &p[1..p.len() - 1];
        let mut out = String::new();
        let mut chars = inner.chars();
        while let Some(c) = chars.next() {
            if c != '\\' {
                out.push(c);
                continue;
            }
            match chars.next() {
                Some('n') => out.push('\n'),
                Some('r') => out.push('\r'),
                Some('t') => out.push('\t'),
                Some('"') => out.push('"'),
                Some('\\') => out.push('\\'),
                Some(d @ '0'..='7') => {
                    let mut oct = String::from(d);
                    oct.push(chars.next().unwrap_or('0'));
                    oct.push(chars.next().unwrap_or('0'));
                    let code = u8::from_str_radix(&oct, 8).unwrap_or(b'?');
                    out.push(code as char);
                }
                Some(other) => {
                    out.push('\\');
                    out.push(other);
                }
                None => out.push('\\'),
            }
        }
        out
    } else {
        p.to_string()
    }
}

fn normalize_path(p: &str) -> String {
    p.trim_end_matches('/').to_string()
}

pub fn parse_worktrees(stdout: &str, main_path: &str) -> Vec<WireWorktree> {
    let mut worktrees = Vec::new();
    let mut id: u32 = 0;
    for block in stdout.split("\n\n") {
        if block.trim().is_empty() {
            // TS splits on `/\n\n+/` (2+ newlines); a lone extra newline still
            // separates, so skip whitespace-only blocks the same way.
            continue;
        }
        let mut path = String::new();
        let mut branch = String::new();
        let mut detached = false;
        let mut locked = false;
        let mut bare = false;
        for line_raw in block.split('\n') {
            let line = line_raw.strip_suffix('\r').unwrap_or(line_raw);
            let trimmed = line.trim();
            if let Some(rest) = line.strip_prefix("worktree ") {
                path = unquote_path(rest);
            } else if let Some(rest) = line.strip_prefix("branch ") {
                branch = rest.replace("refs/heads/", "");
            } else if trimmed == "detached" {
                detached = true;
            } else if trimmed.starts_with("locked") {
                locked = true;
            } else if trimmed == "bare" {
                bare = true;
            }
        }
        if path.is_empty() {
            continue;
        }
        worktrees.push(WireWorktree {
            id: format!("wt:{id}"),
            is_main: normalize_path(&path) == normalize_path(main_path),
            path,
            branch: if detached {
                "detached HEAD".to_string()
            } else if branch.is_empty() {
                if bare {
                    "bare".to_string()
                } else {
                    String::new()
                }
            } else {
                branch
            },
            is_locked: locked,
        });
        id += 1;
    }
    worktrees
}

pub fn parse_numstat(stdout: &str) -> HashMap<String, NumstatEntry> {
    let mut map = HashMap::new();
    // `-z` numstat: "<add>\t<del>\t" then NUL-terminated path. Renames emit
    // two extra NUL tokens (old, new) in place of the inline path.
    let tokens: Vec<&str> = stdout.split('\0').collect();
    let mut i = 0;
    while i < tokens.len() {
        let head = tokens[i];
        if head.is_empty() || !head.contains('\t') {
            i += 1;
            continue;
        }
        let mut parts = head.split('\t');
        let (add_raw, del_raw, inline_path) = (
            parts.next().unwrap_or(""),
            parts.next().unwrap_or(""),
            parts.next(),
        );
        // `-` counts (e.g. binary files) fold to 0, mirroring the TS parser.
        let additions = if add_raw == "-" {
            0
        } else {
            add_raw.parse().unwrap_or(0)
        };
        let deletions = if del_raw == "-" {
            0
        } else {
            del_raw.parse().unwrap_or(0)
        };
        let path = match inline_path {
            Some(p) if !p.is_empty() => {
                i += 1;
                p.to_string()
            }
            _ => {
                // Rename: next two tokens are old then new path (mirrors TS indexing).
                i += 1; // consume old path token (tokens[i])
                let new_path = tokens.get(i + 1).copied().unwrap_or("");
                let path = new_path.to_string();
                i += 2;
                path
            }
        };
        if !path.is_empty() {
            map.insert(
                path,
                NumstatEntry {
                    additions,
                    deletions,
                },
            );
        }
    }
    map
}

pub fn map_code(code: char) -> WireFileStatus {
    match code {
        'A' => WireFileStatus::Added,
        'D' => WireFileStatus::Deleted,
        'R' => WireFileStatus::Renamed,
        'C' => WireFileStatus::Copied,
        'U' => WireFileStatus::Conflicted,
        _ => WireFileStatus::Modified, // 'M', 'T' and anything else
    }
}

fn split_file_path(full: &str) -> (String, String) {
    match full.rfind('/') {
        None => (full.to_string(), String::new()),
        Some(idx) => (full[idx + 1..].to_string(), full[..idx].to_string()),
    }
}

pub struct StatusInput<'a> {
    pub porcelain: &'a str,
    pub staged: &'a HashMap<String, NumstatEntry>,
    pub unstaged: &'a HashMap<String, NumstatEntry>,
}

pub fn parse_status(input: StatusInput) -> Vec<WireWorkingTreeFile> {
    let mut files = Vec::new();
    let mut id: u32 = 0;
    let mut push = |path: String,
                    status: WireFileStatus,
                    staged: bool,
                    counts: Option<&NumstatEntry>,
                    old_path: Option<String>,
                    is_submodule: bool| {
        let (file_name, directory) = split_file_path(&path);
        files.push(WireWorkingTreeFile {
            id: format!("file:{id}"),
            path,
            file_name,
            directory,
            status,
            staged,
            additions: counts.map(|c| c.additions).unwrap_or(0),
            deletions: counts.map(|c| c.deletions).unwrap_or(0),
            old_path,
            is_submodule: Some(is_submodule),
        });
        id += 1;
    };

    let tokens: Vec<&str> = input.porcelain.split('\0').collect();
    let mut i = 0;
    while i < tokens.len() {
        let line = tokens[i];
        if line.is_empty() {
            i += 1;
            continue;
        }
        let kind = line.chars().next().unwrap();
        if kind == '1' {
            // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
            let parts: Vec<&str> = line.split(' ').collect();
            let xy = parts.get(1).copied().unwrap_or("..");
            let sub = parts.get(2).copied().unwrap_or("....");
            let path = parts.get(8..).map(|p| p.join(" ")).unwrap_or_default();
            let is_submodule = sub.starts_with('S');
            let mut chars = xy.chars();
            let (x, y) = (chars.next().unwrap_or('.'), chars.next().unwrap_or('.'));
            if x != '.' {
                push(
                    path.clone(),
                    map_code(x),
                    true,
                    input.staged.get(&path),
                    None,
                    is_submodule,
                );
            }
            if y != '.' {
                let counts = input.unstaged.get(&path);
                push(path, map_code(y), false, counts, None, is_submodule);
            }
        } else if kind == '2' {
            // 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <Xscore> <path> then NUL <origPath>
            let parts: Vec<&str> = line.split(' ').collect();
            let xy = parts.get(1).copied().unwrap_or("..");
            let sub = parts.get(2).copied().unwrap_or("....");
            let path = parts.get(9..).map(|p| p.join(" ")).unwrap_or_default();
            let orig_path = tokens.get(i + 1).map(|s| s.to_string());
            i += 1; // consume origPath token
            let is_submodule = sub.starts_with('S');
            let mut chars = xy.chars();
            let (x, y) = (chars.next().unwrap_or('.'), chars.next().unwrap_or('.'));
            if x != '.' {
                push(
                    path.clone(),
                    map_code(x),
                    true,
                    input.staged.get(&path),
                    orig_path.clone(),
                    is_submodule,
                );
            }
            if y != '.' {
                let counts = input.unstaged.get(&path);
                push(path, map_code(y), false, counts, orig_path, is_submodule);
            }
        } else if kind == 'u' {
            // u <xy> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
            let parts: Vec<&str> = line.split(' ').collect();
            let path = parts.get(10..).map(|p| p.join(" ")).unwrap_or_default();
            push(path, WireFileStatus::Conflicted, false, None, None, false);
        } else if kind == '?' {
            // TS `line.slice(2)` skips the marker and the space.
            let path = line.get(2..).unwrap_or("").to_string();
            push(
                path.clone(),
                WireFileStatus::Untracked,
                false,
                input.unstaged.get(&path),
                None,
                false,
            );
        } else if kind == '!' {
            let path = line.get(2..).unwrap_or("").to_string();
            push(path, WireFileStatus::Ignored, false, None, None, false);
        }
        i += 1;
    }
    files
}

/// Derives in-progress operation state from the `.git` dir (mirrors `stateParser`).
pub fn read_repo_state(git_dir: &Path) -> RepoState {
    let exists = |name: &str| git_dir.join(name).exists();
    let read_trimmed = |parts: &[&str]| -> Option<String> {
        let mut p = git_dir.to_path_buf();
        for part in parts {
            p = p.join(part);
        }
        std::fs::read_to_string(p)
            .ok()
            .map(|s| s.trim().to_string())
    };
    let merging = exists("MERGE_HEAD");
    let cherry_picking = exists("CHERRY_PICK_HEAD");
    let reverting = exists("REVERT_HEAD");
    let bisecting = exists("BISECT_LOG");
    let rebase_merge = exists("rebase-merge");
    let rebase_apply = exists("rebase-apply");
    let rebasing = rebase_merge || rebase_apply;

    let head = read_trimmed(&["HEAD"]);
    let detached_head = head
        .as_ref()
        .map(|h| !h.starts_with("ref:"))
        .unwrap_or(false);

    let operation_label = if rebasing {
        let dir = if rebase_merge {
            "rebase-merge"
        } else {
            "rebase-apply"
        };
        let (num_key, end_key) = if rebase_merge {
            ("msgnum", "end")
        } else {
            ("next", "last")
        };
        match (read_trimmed(&[dir, num_key]), read_trimmed(&[dir, end_key])) {
            (Some(msgnum), Some(end)) if !msgnum.is_empty() && !end.is_empty() => {
                Some(format!("REBASING ({msgnum}/{end})"))
            }
            _ => Some("REBASING".to_string()),
        }
    } else if merging {
        Some("MERGING".to_string())
    } else if cherry_picking {
        Some("CHERRY-PICKING".to_string())
    } else if reverting {
        Some("REVERTING".to_string())
    } else if bisecting {
        Some("BISECTING".to_string())
    } else if detached_head {
        Some("DETACHED HEAD".to_string())
    } else {
        None
    };

    RepoState {
        detached_head,
        merging,
        rebasing,
        cherry_picking,
        reverting,
        bisecting,
        operation_label,
    }
}

pub async fn fetch_branches(
    cwd: &Path,
    favorites: &HashSet<String>,
) -> Result<Vec<WireBranch>, GitError> {
    use crate::git::git_text;
    let (ok, stdout, _) = git_text(
        cwd,
        &[
            "for-each-ref",
            &format!("--format={BRANCH_FORMAT}"),
            BRANCH_REFSPECS[0],
            BRANCH_REFSPECS[1],
            "--sort=-committerdate",
        ],
    )
    .await?;
    if !ok {
        return Err(GitError::unknown("git for-each-ref failed".to_string()));
    }
    Ok(parse_branches(&stdout, favorites))
}

pub async fn fetch_tags(cwd: &Path) -> Vec<WireTag> {
    use crate::git::git_text;
    match git_text(cwd, &["tag", "-l", &format!("--format={TAG_FORMAT}")]).await {
        Ok((true, stdout, _)) => parse_tags(&stdout),
        _ => Vec::new(),
    }
}

pub async fn fetch_remotes(cwd: &Path) -> Vec<WireRemote> {
    use crate::git::git_text;
    match git_text(cwd, &["remote", "-v"]).await {
        Ok((true, stdout, _)) => parse_remotes(&stdout),
        _ => Vec::new(),
    }
}

pub async fn fetch_stashes(cwd: &Path) -> Vec<WireStash> {
    use crate::git::git_text;
    let Ok((_, stdout, _)) =
        git_text(cwd, &["stash", "list", &format!("--format={STASH_FORMAT}")]).await
    else {
        return Vec::new();
    };
    let mut stashes = parse_stashes(&stdout);
    if stashes.is_empty() {
        return stashes;
    }
    // Resolve every stash's base (first parent) in a single `rev-parse`: it
    // prints one line per revision argument, in argument order, so the
    // selectors come back positionally. `--verify` cannot be used here — it
    // accepts exactly one revision — but nothing needs it: an unresolvable
    // selector makes that line echo the argument itself (or fail the whole
    // call), and either way `is_full_sha` rejects it and the base stays unset.
    let revs: Vec<String> = stashes.iter().map(|s| format!("{}^1", s.id)).collect();
    let mut args: Vec<&str> = vec!["rev-parse"];
    args.extend(revs.iter().map(String::as_str));
    if let Ok((_, out, _)) = git_text(cwd, &args).await {
        for (stash, line) in stashes.iter_mut().zip(out.lines()) {
            let sha = line.trim();
            if is_full_sha(sha) {
                stash.base_sha = Some(sha.to_string());
            }
        }
    }
    // Resolve each base's subject in one batch so the UI can explain a stash
    // whose base is outside the loaded commit window (pagination or a base
    // orphaned by amend/rebase). Looked up by sha, not by position: `git log
    // --no-walk` dedupes the revisions it is given and orders them by date.
    // Failures leave `base_subject` empty.
    let mut resolved: Vec<String> = stashes.iter().filter_map(|s| s.base_sha.clone()).collect();
    resolved.sort_unstable();
    resolved.dedup();
    if !resolved.is_empty() {
        let mut args: Vec<&str> = vec!["log", "--no-walk", "--format=%H%x00%s%x00"];
        args.extend(resolved.iter().map(String::as_str));
        if let Ok((true, subject_out, _)) = git_text(cwd, &args).await {
            let subjects = parse_sha_field(&subject_out);
            for stash in stashes.iter_mut() {
                if let Some(sha) = stash.base_sha.as_deref() {
                    if let Some(subject) = subjects.get(sha).filter(|s| !s.is_empty()) {
                        stash.base_subject = Some(subject.clone());
                    }
                }
            }
        }
    }
    stashes
}

/// Parses `git log --format=%H%x00<value>%x00` output into sha -> value.
/// Records are NUL-separated (`git log` puts a newline between them, which is
/// trimmed off the next sha), and the value is kept as its first trimmed line.
fn parse_sha_field(out: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let mut fields = out.split('\0');
    while let Some(sha_field) = fields.next() {
        let sha = sha_field.trim();
        let Some(value) = fields.next() else {
            break;
        };
        if is_full_sha(sha) {
            map.insert(sha.to_string(), value.trim().to_string());
        }
    }
    map
}

/// Base SHAs of `stashes` absent from `commits` (deduped, order kept).
/// These are bases outside the loaded window: orphaned by amend/rebase, or
/// deeper than the commit limit — the stashes GitKraken still anchors.
pub fn missing_stash_base_shas(commits: &[WireCommit], stashes: &[WireStash]) -> Vec<String> {
    let present: HashSet<&str> = commits.iter().map(|c| c.sha.as_str()).collect();
    let mut seen = HashSet::new();
    stashes
        .iter()
        .filter_map(|s| s.base_sha.as_deref())
        .filter(|sha| !present.contains(*sha))
        .filter(|sha| seen.insert(*sha))
        .map(str::to_string)
        .collect()
}

/// Fetch commit objects for stash bases missing from the loaded window so the
/// graph can anchor every stash onto its base (GitKraken parity). Returns the
/// extra commits flagged `is_stash_base` plus their authors. A failed lookup
/// (e.g. a pruned base) yields nothing — those stashes keep the floating
/// fallback with the base hint.
pub async fn fetch_missing_stash_bases(
    cwd: &Path,
    commits: &[WireCommit],
    stashes: &[WireStash],
) -> (Vec<WireCommit>, Vec<WireAuthor>) {
    use crate::git::git_text;
    use crate::log::{parse_commits, AuthorRegistry};
    let missing = missing_stash_base_shas(commits, stashes);
    if missing.is_empty() {
        return (Vec::new(), Vec::new());
    }
    let mut args: Vec<String> = vec![
        "log".to_string(),
        "--no-walk".to_string(),
        "--date=iso-strict".to_string(),
        format!("--format={}", crate::log::log_format()),
        "--decorate=full".to_string(),
    ];
    args.extend(missing);
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let Ok((ok, stdout, _)) = git_text(cwd, &arg_refs).await else {
        return (Vec::new(), Vec::new());
    };
    if !ok {
        return (Vec::new(), Vec::new());
    }
    let mut registry = AuthorRegistry::default();
    let mut bases = parse_commits(&stdout, &mut registry);
    for base in bases.iter_mut() {
        base.is_stash_base = true;
    }
    (bases, registry.all())
}

pub async fn fetch_worktrees(cwd: &Path, main_path: &Path) -> Vec<WireWorktree> {
    use crate::git::git_text;
    match git_text(cwd, &["worktree", "list", "--porcelain"]).await {
        Ok((_, stdout, _)) => parse_worktrees(&stdout, &main_path.to_string_lossy()),
        Err(_) => Vec::new(),
    }
}

pub async fn fetch_working_tree(cwd: &Path) -> Result<Vec<WireWorkingTreeFile>, GitError> {
    use crate::git::git_text;
    let (status_out, staged_out, unstaged_out) = tokio::join!(
        git_text(cwd, &["status", "--porcelain=v2", "-z", "-uall"]),
        git_text(cwd, &["diff", "--cached", "--numstat", "-z"]),
        git_text(cwd, &["diff", "--numstat", "-z"]),
    );
    let (ok, porcelain, _) = status_out?;
    if !ok {
        return Err(GitError::unknown("git status failed".to_string()));
    }
    let staged = staged_out
        .map(|(_, out, _)| parse_numstat(&out))
        .unwrap_or_default();
    let unstaged = unstaged_out
        .map(|(_, out, _)| parse_numstat(&out))
        .unwrap_or_default();
    Ok(parse_status(StatusInput {
        porcelain: &porcelain,
        staged: &staged,
        unstaged: &unstaged,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_local_branch_with_tracking() {
        let line = "refs/heads/main\x1fabc123\x1f*\x1forigin/main\x1f[ahead 2, behind 1]\x1f2024-05-01T12:00:00+00:00";
        let branches = parse_branches(line, &HashSet::new());
        assert_eq!(branches.len(), 1);
        let b = &branches[0];
        assert_eq!(b.id, "local:main");
        assert!(matches!(b.kind, WireBranchKind::Local));
        assert_eq!(b.ahead, 2);
        assert_eq!(b.behind, 1);
        assert!(b.is_current);
        assert_eq!(b.upstream.as_deref(), Some("origin/main"));
        assert_eq!(b.last_activity, "2024-05-01T12:00:00.000Z");
    }

    #[test]
    fn parses_remote_branch_and_skips_symbolic_head() {
        let stdout = "refs/remotes/origin/HEAD\x1fabc\x1f \x1f\x1f\x1f2024-05-01T12:00:00+00:00\nrefs/remotes/origin/feat/x\x1fdef\x1f \x1f\x1f\x1f2024-05-01T12:00:00+00:00";
        let branches = parse_branches(stdout, &HashSet::new());
        assert_eq!(branches.len(), 1);
        let b = &branches[0];
        assert!(matches!(b.kind, WireBranchKind::Remote));
        assert_eq!(b.id, "remote:origin/feat/x");
        assert_eq!(b.name, "feat/x");
        assert_eq!(b.remote.as_deref(), Some("origin"));
        assert_eq!(b.group, "feat");
    }

    #[test]
    fn drops_gone_upstream() {
        let line = "refs/heads/old\x1fabc\x1f \x1f\x1f[gone]\x1f2024-05-01T12:00:00+00:00";
        let branches = parse_branches(line, &HashSet::new());
        assert_eq!(branches[0].upstream, None);
    }

    #[test]
    fn marks_favorites() {
        let line = "refs/heads/main\x1fabc\x1f*\x1f\x1f\x1f2024-05-01T12:00:00+00:00";
        let favs: HashSet<String> = ["main".to_string()].into_iter().collect();
        let branches = parse_branches(line, &favs);
        assert!(branches[0].is_favorite);
    }

    #[test]
    fn parses_annotated_and_lightweight_tags() {
        let annotated =
            "v2.0\x1ftagobj\x1fcommitsha\x1ftag\x1f2024-01-02T00:00:00+00:00\x1fRelease";
        let lightweight = "v1.0\x1fcommitsha\x1f\x1fcommit\x1f2024-01-01T00:00:00+00:00\x1f";
        let tags = parse_tags(&format!("{annotated}\n{lightweight}"));
        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0].id, "tag:v2.0");
        assert_eq!(tags[0].sha, "commitsha");
        assert!(tags[0].annotated);
        assert_eq!(tags[1].sha, "commitsha");
        assert!(!tags[1].annotated);
    }

    #[test]
    fn parses_remotes_fetch_and_push() {
        let stdout = "origin\thttps://github.com/a/b.git (fetch)\norigin\thttps://github.com/a/b.git (push)\nupstream\tgit@x:y.git (fetch)\n";
        let remotes = parse_remotes(stdout);
        assert_eq!(remotes.len(), 2);
        assert_eq!(remotes[0].fetch_url, "https://github.com/a/b.git");
        assert_eq!(remotes[0].push_url, "https://github.com/a/b.git");
        assert_eq!(remotes[1].push_url, "");
    }

    #[test]
    fn parses_stash_list_with_branch() {
        let stdout = "stash@{0}\x1f1700000000\x1fWIP on main: abc1234 my work";
        let stashes = parse_stashes(stdout);
        assert_eq!(stashes.len(), 1);
        assert_eq!(stashes[0].id, "stash@{0}");
        assert_eq!(stashes[0].index, 0);
        assert_eq!(stashes[0].branch, "main");
        assert_eq!(stashes[0].date, "2023-11-14T22:13:20.000Z");
        assert_eq!(stashes[0].base_sha, None);
        assert_eq!(stashes[0].base_subject, None);
    }

    #[tokio::test]
    async fn resolves_base_for_every_stash() {
        // Regression test: `rev-parse --verify` accepts exactly one revision,
        // so resolving all stashes in a single call returned no base at all.
        let dir = std::env::temp_dir().join(format!("git-light-stash-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let run = |args: &[&str]| {
            std::process::Command::new("git")
                .args(args)
                .current_dir(&dir)
                .output()
                .unwrap()
        };
        assert!(run(&["init"]).status.success());
        run(&["config", "user.name", "T"]);
        run(&["config", "user.email", "t@t"]);
        run(&["config", "commit.gpgsign", "false"]);
        std::fs::write(dir.join("f.txt"), "one\n").unwrap();
        run(&["add", "."]);
        assert!(run(&["commit", "-m", "one"]).status.success());
        std::fs::write(dir.join("f.txt"), "two\n").unwrap();
        assert!(run(&["stash", "push", "-m", "first"]).status.success());
        std::fs::write(dir.join("f.txt"), "three\n").unwrap();
        assert!(run(&["stash", "push", "-m", "second"]).status.success());
        let stashes = fetch_stashes(&dir).await;
        assert_eq!(stashes.len(), 2);
        assert!(
            stashes.iter().all(|s| s.base_sha.is_some()),
            "missing base: {:?}",
            stashes.iter().map(|s| &s.base_sha).collect::<Vec<_>>()
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn attributes_each_stash_base_and_subject() {
        // Stashes created on different commits: the batched resolutions must
        // map each base back to its own stash. Subjects come from a second
        // batch that `git log --no-walk` reorders by date and dedupes, so a
        // positional pairing would swap the two subjects here.
        let dir =
            std::env::temp_dir().join(format!("git-light-stash-base-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let run = |args: &[&str]| {
            std::process::Command::new("git")
                .args(args)
                .current_dir(&dir)
                .output()
                .unwrap()
        };
        let sha = |args: &[&str]| {
            String::from_utf8(run(args).stdout)
                .unwrap()
                .trim()
                .to_string()
        };
        assert!(run(&["init"]).status.success());
        run(&["config", "user.name", "T"]);
        run(&["config", "user.email", "t@t"]);
        run(&["config", "commit.gpgsign", "false"]);
        std::fs::write(dir.join("f.txt"), "one\n").unwrap();
        run(&["add", "."]);
        assert!(run(&["commit", "-m", "first"]).status.success());
        let first = sha(&["rev-parse", "HEAD"]);
        std::fs::write(dir.join("f.txt"), "dirty\n").unwrap();
        assert!(run(&["stash", "push", "-m", "on-first"]).status.success());
        std::fs::write(dir.join("f.txt"), "two\n").unwrap();
        run(&["add", "."]);
        assert!(run(&["commit", "-m", "second"]).status.success());
        let second = sha(&["rev-parse", "HEAD"]);
        std::fs::write(dir.join("f.txt"), "dirty again\n").unwrap();
        assert!(run(&["stash", "push", "-m", "on-second"]).status.success());

        let stashes = fetch_stashes(&dir).await;
        assert_eq!(stashes.len(), 2);
        assert_eq!(stashes[0].base_sha.as_deref(), Some(second.as_str()));
        assert_eq!(stashes[1].base_sha.as_deref(), Some(first.as_str()));
        assert_eq!(stashes[0].base_subject.as_deref(), Some("second"));
        assert_eq!(stashes[1].base_subject.as_deref(), Some("first"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn missing_stash_bases_skips_loaded_and_dedups() {
        use crate::git::{WireAuthor, WireCommit};
        let author = || WireAuthor {
            name: "A".to_string(),
            email: "a@example.com".to_string(),
            avatar_url: String::new(),
            initials: "A".to_string(),
            color: "#fff".to_string(),
        };
        let commit = |sha: &str| WireCommit {
            sha: sha.to_string(),
            short_sha: sha.chars().take(7).collect(),
            is_merge: false,
            parents: Vec::new(),
            subject: "subject".to_string(),
            body: None,
            author: author(),
            committer: author(),
            date: "2023-11-14T22:13:20.000Z".to_string(),
            refs: Vec::new(),
            is_cherry_pick: false,
            is_stash_base: false,
        };
        let stash = |base: Option<&str>| WireStash {
            id: "stash@{0}".to_string(),
            index: 0,
            message: "WIP on main: subject".to_string(),
            branch: "main".to_string(),
            date: "2023-11-14T22:13:20.000Z".to_string(),
            files_changed: 0,
            base_sha: base.map(str::to_string),
            base_subject: None,
        };
        let commits = vec![commit("aaa")];
        let stashes = vec![
            stash(Some("aaa")),
            stash(Some("bbb")),
            stash(Some("bbb")),
            stash(None),
        ];
        assert_eq!(
            missing_stash_base_shas(&commits, &stashes),
            vec!["bbb".to_string()]
        );
    }

    #[test]
    fn parses_worktree_porcelain() {
        let stdout = "worktree /repo\nbranch refs/heads/main\n\nworktree /other\nbranch refs/heads/feat\nlocked reason\n";
        let worktrees = parse_worktrees(stdout, "/repo");
        assert_eq!(worktrees.len(), 2);
        assert_eq!(worktrees[0].id, "wt:0");
        assert!(worktrees[0].is_main);
        assert!(!worktrees[0].is_locked);
        assert_eq!(worktrees[1].branch, "feat");
        assert!(worktrees[1].is_locked);
    }

    #[test]
    fn parses_simple_numstat() {
        let map = parse_numstat("3\t1\tsrc/a.ts\0");
        let entry = map.get("src/a.ts").expect("entry");
        assert_eq!(entry.additions, 3);
        assert_eq!(entry.deletions, 1);
    }

    #[test]
    fn parses_status_modified_row() {
        let staged = HashMap::new();
        let mut unstaged = HashMap::new();
        unstaged.insert(
            "src/file.ts".to_string(),
            NumstatEntry {
                additions: 2,
                deletions: 1,
            },
        );
        let files = parse_status(StatusInput {
            porcelain: "1 .M N... 100644 100644 100644 abc def src/file.ts\0",
            staged: &staged,
            unstaged: &unstaged,
        });
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "src/file.ts");
        assert!(matches!(files[0].status, WireFileStatus::Modified));
        assert!(!files[0].staged);
        assert_eq!(files[0].additions, 2);
        assert_eq!(files[0].id, "file:0");
    }

    #[test]
    fn splits_staged_and_unstaged_rows() {
        let mut staged = HashMap::new();
        staged.insert(
            "src/file.ts".to_string(),
            NumstatEntry {
                additions: 1,
                deletions: 0,
            },
        );
        let mut unstaged = HashMap::new();
        unstaged.insert(
            "src/file.ts".to_string(),
            NumstatEntry {
                additions: 0,
                deletions: 2,
            },
        );
        let files = parse_status(StatusInput {
            porcelain: "1 MM N... 100644 100644 100644 a b src/file.ts\0",
            staged: &staged,
            unstaged: &unstaged,
        });
        assert_eq!(files.iter().filter(|f| f.staged).count(), 1);
        assert_eq!(files.iter().filter(|f| !f.staged).count(), 1);
    }

    #[test]
    fn maps_status_codes() {
        assert!(matches!(map_code('A'), WireFileStatus::Added));
        assert!(matches!(map_code('D'), WireFileStatus::Deleted));
        assert!(matches!(map_code('R'), WireFileStatus::Renamed));
        assert!(matches!(map_code('U'), WireFileStatus::Conflicted));
        assert!(matches!(map_code('M'), WireFileStatus::Modified));
        assert!(matches!(map_code('T'), WireFileStatus::Modified));
        assert!(matches!(map_code('?'), WireFileStatus::Modified));
    }

    #[test]
    fn detects_operation_state_from_git_dir() {
        let dir = std::env::temp_dir().join("git-light-state-test");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("HEAD"), "ref: refs/heads/main\n").unwrap();
        let clean = read_repo_state(&dir);
        assert!(!clean.merging);
        assert_eq!(clean.operation_label, None);
        std::fs::write(dir.join("MERGE_HEAD"), "abc\n").unwrap();
        let merging = read_repo_state(&dir);
        assert!(merging.merging);
        assert_eq!(merging.operation_label.as_deref(), Some("MERGING"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
