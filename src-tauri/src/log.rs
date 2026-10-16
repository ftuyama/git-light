use std::collections::HashMap;

use crate::git::{WireAuthor, WireCommit, WireRef, WireRefType};

pub const FIELD: char = '\x1f';
pub const RECORD: char = '\x1e';

/// Pretty-format for `git log`. Must stay in sync with the TS `LOG_FORMAT`.
pub fn log_format() -> String {
    [
        "%H", "%P", "%an", "%ae", "%cn", "%ce", "%at", "%D", "%s", "%b",
    ]
    .join(&FIELD.to_string())
        + &RECORD.to_string()
}

const AVATAR_COLORS: [&str; 8] = [
    "#a371f7", "#3fb950", "#58a6ff", "#f0883e", "#db61a2", "#e3b341", "#56d4dd", "#ff7b72",
];

/// JS `hashString` (32-bit signed overflow over UTF-16 units).
pub(crate) fn hash_string(value: &str) -> u32 {
    let mut hash: i32 = 0;
    for unit in value.encode_utf16() {
        hash = hash.wrapping_mul(31).wrapping_add(unit as i32);
    }
    hash.unsigned_abs()
}

/// Mirrors `initialsFor` in `shared/git/avatar.ts`.
pub fn initials_for(name: &str) -> String {
    let parts: Vec<&str> = name.split_whitespace().collect();
    if parts.is_empty() {
        return "?".to_string();
    }
    if parts.len() == 1 {
        return parts[0].chars().take(2).collect::<String>().to_uppercase();
    }
    let first = parts[0].chars().next().unwrap_or('?');
    let last = parts[parts.len() - 1].chars().next().unwrap_or('?');
    format!("{first}{last}").to_uppercase()
}

fn percent_encode(segment: &str) -> String {
    let mut out = String::new();
    for b in segment.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// Mirrors `githubAvatarUrl` in `shared/git/avatar.ts`.
pub fn github_avatar_url(email: &str, size: u32) -> String {
    let normalized = email.trim().to_lowercase();
    let Some(local) = normalized.strip_suffix("@users.noreply.github.com") else {
        return String::new();
    };
    let username = if let Some((prefix, rest)) = local.split_once('+') {
        if prefix.is_empty()
            || !prefix.chars().all(|c| c.is_ascii_digit())
            || rest.is_empty()
            || rest.contains(['+', '@'])
        {
            return String::new();
        }
        rest
    } else {
        if local.is_empty() || local.contains('@') {
            return String::new();
        }
        local
    };
    let px = size.clamp(1, 460);
    format!(
        "https://github.com/{}.png?size={px}",
        percent_encode(username)
    )
}

/// Deduplicates authors by email with stable colors (mirrors `AuthorRegistry`).
#[derive(Default)]
pub struct AuthorRegistry {
    by_email: HashMap<String, WireAuthor>,
}

impl AuthorRegistry {
    pub fn resolve(&mut self, name: &str, email: &str) -> WireAuthor {
        let lowered_email = email.to_lowercase();
        let key = if lowered_email.is_empty() {
            name.to_lowercase()
        } else {
            lowered_email
        };
        if let Some(existing) = self.by_email.get(&key) {
            return existing.clone();
        }
        let display = if name.is_empty() { email } else { name };
        let author = WireAuthor {
            name: display.to_string(),
            email: email.to_string(),
            avatar_url: github_avatar_url(email, 80),
            initials: initials_for(display),
            color: AVATAR_COLORS[hash_string(&key) as usize % AVATAR_COLORS.len()].to_string(),
        };
        self.by_email.insert(key, author.clone());
        author
    }

    pub fn all(&self) -> Vec<WireAuthor> {
        self.by_email.values().cloned().collect()
    }
}

/// Mirrors `formatRefLabel` in `shared/git/refLabel.ts`.
pub fn format_ref_label(name: &str, ref_type: Option<&WireRefType>) -> String {
    let mut label = name.trim().to_string();
    if label.is_empty() {
        return label;
    }
    if let Some(rest) = label.strip_prefix("refs/remotes/") {
        label = rest.to_string();
        if let Some(slash) = label.find('/') {
            label = label[slash + 1..].to_string();
        }
    } else if let Some(rest) = label.strip_prefix("refs/heads/") {
        label = rest.to_string();
    } else if let Some(rest) = label.strip_prefix("refs/tags/") {
        label = rest.to_string();
    } else if label == "refs/stash" || ref_type == Some(&WireRefType::Stash) {
        return "stash".to_string();
    } else if ref_type == Some(&WireRefType::RemoteBranch) {
        if let Some(slash) = label.find('/') {
            label = label[slash + 1..].to_string();
        }
    }
    label
}

fn is_stash_entry(entry: &str) -> bool {
    if entry == "refs/stash" || entry == "stash" {
        return true;
    }
    entry.starts_with("stash@{") && entry.ends_with('}')
}

fn parse_ref_entry(entry: &str) -> Vec<WireRef> {
    if is_stash_entry(entry) {
        return vec![WireRef {
            ref_type: WireRefType::Stash,
            name: entry.to_string(),
            label: "stash".to_string(),
            is_head: None,
        }];
    }
    if let Some(branch) = entry.strip_prefix("HEAD -> ") {
        let branch = branch.trim().to_string();
        return vec![WireRef {
            ref_type: WireRefType::LocalBranch,
            name: branch.clone(),
            label: format_ref_label(&branch, Some(&WireRefType::LocalBranch)),
            is_head: Some(true),
        }];
    }
    if entry == "HEAD" {
        return Vec::new();
    }
    if let Some(raw) = entry.strip_prefix("tag: ") {
        let raw = raw.trim();
        let tag = raw.strip_prefix("refs/tags/").unwrap_or(raw).to_string();
        return vec![WireRef {
            ref_type: WireRefType::Tag,
            name: tag.clone(),
            label: format_ref_label(&tag, Some(&WireRefType::Tag)),
            is_head: None,
        }];
    }
    if entry.starts_with("refs/heads/") {
        return vec![WireRef {
            ref_type: WireRefType::LocalBranch,
            name: entry.to_string(),
            label: format_ref_label(entry, Some(&WireRefType::LocalBranch)),
            is_head: None,
        }];
    }
    if let Some(rest) = entry.strip_prefix("refs/remotes/") {
        if rest == "HEAD" || rest.ends_with("/HEAD") {
            return Vec::new();
        }
        return vec![WireRef {
            ref_type: WireRefType::RemoteBranch,
            name: entry.to_string(),
            label: format_ref_label(entry, Some(&WireRefType::RemoteBranch)),
            is_head: None,
        }];
    }
    if entry.contains('/') {
        if entry.ends_with("/HEAD") {
            return Vec::new();
        }
        return vec![WireRef {
            ref_type: WireRefType::RemoteBranch,
            name: entry.to_string(),
            label: format_ref_label(entry, Some(&WireRefType::RemoteBranch)),
            is_head: None,
        }];
    }
    vec![WireRef {
        ref_type: WireRefType::LocalBranch,
        name: entry.to_string(),
        label: format_ref_label(entry, Some(&WireRefType::LocalBranch)),
        is_head: None,
    }]
}

fn parse_decorations(raw: &str) -> Vec<WireRef> {
    let mut refs = Vec::new();
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return refs;
    }
    for entry_raw in trimmed.split(',') {
        let entry = entry_raw.trim();
        if entry.is_empty() {
            continue;
        }
        refs.extend(parse_ref_entry(entry));
    }
    refs
}

/// Parses raw `git log` output (using [`log_format`]) into wire commits.
pub fn parse_commits(stdout: &str, authors: &mut AuthorRegistry) -> Vec<WireCommit> {
    let mut commits = Vec::new();
    for record in stdout.split(RECORD) {
        let cleaned = record.trim_start_matches(['\r', '\n']);
        if cleaned.trim().is_empty() {
            continue;
        }
        let fields: Vec<&str> = cleaned.split(FIELD).collect();
        if fields.len() < 10 {
            continue;
        }
        let (sha, parents_raw, an, ae, cn, ce, at, decorations, subject, body) = (
            fields[0], fields[1], fields[2], fields[3], fields[4], fields[5], fields[6], fields[7],
            fields[8], fields[9],
        );
        if sha.is_empty() {
            continue;
        }
        let parents: Vec<String> = if parents_raw.trim().is_empty() {
            Vec::new()
        } else {
            parents_raw.split_whitespace().map(str::to_string).collect()
        };
        let body_text = body.trim_end().to_string();
        let Ok(timestamp) = at.trim().parse::<i64>() else {
            continue;
        };
        let date = chrono::DateTime::from_timestamp(timestamp, 0)
            .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
            .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string());
        commits.push(WireCommit {
            sha: sha.to_string(),
            short_sha: sha.chars().take(7).collect(),
            is_merge: parents.len() > 1,
            parents,
            subject: subject.to_string(),
            body: if body_text.is_empty() {
                None
            } else {
                Some(body_text.clone())
            },
            author: authors.resolve(an, ae),
            committer: authors.resolve(cn, ce),
            date,
            refs: parse_decorations(decorations),
            is_cherry_pick: is_cherry_pick(&body_text),
        });
    }
    commits
}

fn is_cherry_pick(body: &str) -> bool {
    const MARKER: &str = "(cherry picked from commit ";
    let lower = body.to_lowercase();
    let mut rest = lower.as_str();
    while let Some(idx) = rest.find(MARKER) {
        let after = &rest[idx + MARKER.len()..];
        if after.chars().take_while(|c| c.is_ascii_hexdigit()).count() >= 1 {
            return true;
        }
        rest = after;
    }
    false
}

/// Graph filter: stash commits render as inline stash rows, and `index on …`
/// helper commits stay out of the main lane layout (mirrors `fetchCommitLog`).
pub fn filter_graph_commits(commits: Vec<WireCommit>) -> Vec<WireCommit> {
    commits
        .into_iter()
        .filter(|c| {
            if c.refs.iter().any(|r| r.ref_type == WireRefType::Stash) {
                return false;
            }
            let lower = c.subject.to_lowercase();
            if lower.starts_with("wip on ")
                || lower.starts_with("on ")
                || lower.starts_with("index on ")
            {
                return false;
            }
            true
        })
        .collect()
}

pub struct CommitBundle {
    pub commits: Vec<WireCommit>,
    pub authors: Vec<WireAuthor>,
    pub has_more: bool,
    pub oldest_sha: Option<String>,
}

/// Mirrors `fetchCommitLog`: `limit + 1` probe, stash/WIP filter, truncation.
pub async fn fetch_commit_log(
    cwd: &std::path::Path,
    limit: usize,
    all: bool,
    end_rev: Option<&str>,
    skip: u32,
) -> Result<CommitBundle, crate::git::GitError> {
    use crate::git::{git_text, GitError};
    let fetch_limit = limit + 1;
    let mut args: Vec<String> = vec!["log".to_string()];
    if all {
        args.push("--all".to_string());
    }
    args.push("--date=iso-strict".to_string());
    args.push(format!("--format={}", log_format()));
    args.push("--decorate=full".to_string());
    args.push("-n".to_string());
    args.push(fetch_limit.to_string());
    if let Some(rev) = end_rev {
        args.push(rev.to_string());
    }
    if skip > 0 {
        args.push("--skip".to_string());
        args.push(skip.to_string());
    }
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let (ok, stdout, _) = git_text(cwd, &arg_refs).await?;
    if !ok && end_rev.is_none() {
        return Err(GitError::unknown("git log failed".to_string()));
    }
    let mut authors = AuthorRegistry::default();
    let parsed = parse_commits(&stdout, &mut authors);
    let raw_len = parsed.len();
    let mut kept = filter_graph_commits(parsed);
    let has_more = raw_len > limit || kept.len() > limit;
    kept.truncate(limit);
    let oldest_sha = kept.last().map(|c| c.sha.clone());
    Ok(CommitBundle {
        commits: kept,
        authors: authors.all(),
        has_more,
        oldest_sha,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[tokio::test]
    async fn fetches_live_log_with_limit() {
        let cwd = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let bundle = fetch_commit_log(&cwd, 5, true, None, 0)
            .await
            .expect("log must work");
        assert!(!bundle.commits.is_empty());
        assert!(bundle.commits.len() <= 5);
        assert!(bundle.commits.iter().all(|c| c.sha.len() == 40));
        assert_eq!(
            bundle.oldest_sha.as_deref(),
            bundle.commits.last().map(|c| c.sha.as_str())
        );
        assert!(!bundle.authors.is_empty());
    }

    fn commit_record(decorations: &str) -> String {
        [
            "abc1234567890abcdef1234567890abcdef1234567",
            "",
            "Author",
            "author@example.com",
            "Author",
            "author@example.com",
            "1700000000",
            decorations,
            "subject",
            "",
        ]
        .join(&FIELD.to_string())
            + &RECORD.to_string()
    }

    fn parse_one(decorations: &str) -> WireCommit {
        let mut authors = AuthorRegistry::default();
        let commits = parse_commits(&commit_record(decorations), &mut authors);
        assert_eq!(commits.len(), 1);
        commits.into_iter().next().unwrap()
    }

    #[test]
    fn log_format_ends_with_record_marker() {
        assert!(log_format().ends_with(RECORD));
    }

    #[test]
    fn preserves_folder_branch_names() {
        let commit = parse_one("HEAD -> refs/heads/ENG/bla, refs/remotes/origin/ENG/bla");
        let labels: Vec<_> = commit.refs.iter().map(|r| r.label.as_str()).collect();
        assert_eq!(labels, vec!["ENG/bla", "ENG/bla"]);
    }

    #[test]
    fn classifies_refs_heads_as_local() {
        let commit = parse_one("refs/heads/ENG/bla");
        assert_eq!(commit.refs.len(), 1);
        assert!(matches!(commit.refs[0].ref_type, WireRefType::LocalBranch));
        assert_eq!(commit.refs[0].name, "refs/heads/ENG/bla");
        assert_eq!(commit.refs[0].label, "ENG/bla");
        assert_eq!(commit.refs[0].is_head, None);
    }

    #[test]
    fn parses_short_decorate_output() {
        let commit = parse_one("HEAD -> ENG/bla, origin/ENG/bla");
        let labels: Vec<_> = commit.refs.iter().map(|r| r.label.as_str()).collect();
        assert_eq!(labels, vec!["ENG/bla", "ENG/bla"]);
    }

    #[test]
    fn hides_head_pseudo_ref_but_keeps_is_head() {
        let commit = parse_one("HEAD -> ENG/bla, origin/ENG/bla");
        assert!(!commit
            .refs
            .iter()
            .any(|r| matches!(r.ref_type, WireRefType::Head)));
        let head: Vec<_> = commit
            .refs
            .iter()
            .filter(|r| r.is_head == Some(true))
            .collect();
        assert_eq!(head.len(), 1);
        assert_eq!(head[0].name, "ENG/bla");
    }

    #[test]
    fn hides_detached_head() {
        let commit = parse_one("HEAD");
        assert!(commit.refs.is_empty());
    }

    #[test]
    fn hides_symbolic_origin_head_full() {
        let commit = parse_one(
            "HEAD -> refs/heads/main, refs/remotes/origin/HEAD, refs/remotes/origin/main",
        );
        assert!(!commit.refs.iter().any(|r| r.label == "HEAD"));
        let mut labels: Vec<_> = commit.refs.iter().map(|r| r.label.as_str()).collect();
        labels.sort();
        assert_eq!(labels, vec!["main", "main"]);
    }

    #[test]
    fn hides_symbolic_origin_head_short() {
        let commit = parse_one("HEAD -> main, origin/HEAD, origin/main");
        assert!(!commit.refs.iter().any(|r| r.label == "HEAD"));
        let mut labels: Vec<_> = commit.refs.iter().map(|r| r.label.as_str()).collect();
        labels.sort();
        assert_eq!(labels, vec!["main", "main"]);
    }

    #[test]
    fn parses_tags() {
        let commit = parse_one("tag: v1.2.3");
        assert_eq!(commit.refs.len(), 1);
        assert!(matches!(commit.refs[0].ref_type, WireRefType::Tag));
        assert_eq!(commit.refs[0].name, "v1.2.3");
        assert_eq!(commit.refs[0].label, "v1.2.3");
    }

    #[test]
    fn parses_stash_refs_for_filtering() {
        let commit = parse_one("refs/stash");
        assert!(commit
            .refs
            .iter()
            .any(|r| matches!(r.ref_type, WireRefType::Stash)));
    }

    #[test]
    fn commit_dates_are_iso_strings() {
        let commit = parse_one("");
        assert_eq!(commit.date, "2023-11-14T22:13:20.000Z");
        assert_eq!(commit.short_sha, "abc1234");
        assert!(commit.parents.is_empty());
        assert!(!commit.is_merge);
    }

    #[test]
    fn detects_cherry_picks() {
        let mut authors = AuthorRegistry::default();
        let body_record = [
            "abc1234567890abcdef1234567890abcdef1234567",
            "",
            "Author",
            "author@example.com",
            "Author",
            "author@example.com",
            "1700000000",
            "",
            "fix",
            "(cherry picked from commit deadbeef1234)",
        ]
        .join(&FIELD.to_string())
            + &RECORD.to_string();
        let commits = parse_commits(&body_record, &mut authors);
        assert!(commits[0].is_cherry_pick);
    }

    #[test]
    fn graph_filter_drops_stash_and_wip_helpers() {
        let mut authors = AuthorRegistry::default();
        let mut commits = parse_commits(
            &format!("{}{}", commit_record("refs/stash"), commit_record("")),
            &mut authors,
        );
        assert_eq!(commits.len(), 2);
        commits[1].subject = "WIP on main: abc1234 work".to_string();
        let kept = filter_graph_commits(commits);
        assert!(kept.is_empty());
    }

    #[test]
    fn author_registry_is_stable_per_email() {
        let mut registry = AuthorRegistry::default();
        let a = registry.resolve("Ada", "ADA@example.com");
        let b = registry.resolve("Different", "ada@example.com");
        assert_eq!(a.color, b.color);
        assert_eq!(registry.all().len(), 1);
    }

    #[test]
    fn initials_match_shared_avatar_rules() {
        assert_eq!(initials_for("Ada Lovelace"), "AL");
        assert_eq!(initials_for("plato"), "PL");
        assert_eq!(initials_for(""), "?");
    }

    #[test]
    fn avatar_url_only_for_noreply_emails() {
        assert_eq!(
            github_avatar_url("octocat@users.noreply.github.com", 80),
            "https://github.com/octocat.png?size=80"
        );
        assert_eq!(
            github_avatar_url("123+octocat@users.noreply.github.com", 80),
            "https://github.com/octocat.png?size=80"
        );
        assert_eq!(github_avatar_url("ada@example.com", 80), "");
    }
}
