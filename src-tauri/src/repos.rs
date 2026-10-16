use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::git::GitError;

/// A repository found by scanning a folder.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredRepo {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneRepoRequest {
    pub url: String,
    pub parent_path: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitRepoRequest {
    pub path: String,
    pub default_branch: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverReposRequest {
    pub root: String,
    pub max_depth: Option<u8>,
}

/// Schemes accepted for `scheme://` clone URLs. `git` itself supports more,
/// but this allowlist keeps credential handling to HTTPS/SSH-style remotes
/// (plus local `file://` for tests and offline mirrors) instead of arbitrary
/// helpers like `ext::`.
const ALLOWED_SCHEMES: [&str; 5] = ["https", "http", "ssh", "git", "file"];

/// Validate a user-supplied clone URL. Returns the trimmed URL.
///
/// Accepts `scheme://` URLs with an allowlisted scheme and scp-like
/// `user@host:path` syntax. Rejects flags, whitespace, control bytes and
/// shell metacharacters that could smuggle extra `git` arguments.
pub fn validate_clone_url(raw: &str) -> Result<String, GitError> {
    let url = raw.trim();
    if url.is_empty() {
        return Err(GitError::unknown(
            "Enter a repository URL to clone.".to_string(),
        ));
    }
    if url.contains(['\0', '\n', '\r']) || url.starts_with('-') {
        return Err(GitError::unknown(
            "That repository URL looks invalid.".to_string(),
        ));
    }
    if url.chars().any(|c| c.is_whitespace()) {
        return Err(GitError::unknown(
            "That repository URL looks invalid.".to_string(),
        ));
    }
    // Block shell interpolation if the value ever reaches a non-argv path.
    if url.contains([';', '&', '|', '`', '$', '(', ')']) {
        return Err(GitError::unknown(
            "That repository URL looks invalid.".to_string(),
        ));
    }
    if let Some((scheme, _rest)) = url.split_once("://") {
        let scheme = scheme.to_lowercase();
        if !ALLOWED_SCHEMES.contains(&scheme.as_str()) {
            return Err(GitError::unknown(format!(
                "URLs with the \"{scheme}\" scheme are not supported for cloning."
            )));
        }
        // `file://` must resolve to an absolute local path.
        if scheme == "file" {
            let path_part = url.split_once("://").map(|(_, r)| r).unwrap_or("");
            let path_part = path_part.trim_start_matches("localhost");
            if !path_part.starts_with('/') {
                return Err(GitError::unknown(
                    "That repository URL looks invalid.".to_string(),
                ));
            }
        }
        return Ok(url.to_string());
    }
    // Scp-like syntax: `git@github.com:org/repo.git`.
    if url.contains('@') && url.contains(':') {
        let (user_host, _path) = url.split_once(':').unwrap_or((url, ""));
        if user_host.contains('@') && !user_host.contains('/') && !_path.is_empty() {
            return Ok(url.to_string());
        }
    }
    Err(GitError::unknown(
        "That repository URL looks invalid. Use an https:// or git@host: URL.".to_string(),
    ))
}

/// Derive a folder name from a clone URL: last path segment after `/` or
/// `:`, with a trailing `.git` stripped and unsafe characters removed.
pub fn derive_repo_name(url: &str) -> String {
    let trimmed = url.trim().trim_end_matches('/');
    let after_slash = trimmed.rsplit('/').next().unwrap_or(trimmed);
    let after_colon = after_slash.rsplit(':').next().unwrap_or(after_slash);
    let mut name = after_colon
        .strip_suffix(".git")
        .unwrap_or(after_colon)
        .to_string();
    if name.is_empty() {
        name = "repo".to_string();
    }
    sanitize_dir_name(&name)
}

/// Keep only filesystem-safe characters for a single path segment.
pub fn sanitize_dir_name(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches('.').trim();
    if trimmed.is_empty() {
        "repo".to_string()
    } else {
        trimmed.chars().take(100).collect()
    }
}

/// Resolve the clone destination `parent/name`, validating both.
pub fn destination_for_clone(parent: &Path, name: &str) -> Result<PathBuf, GitError> {
    if name.is_empty() || name == "." || name == ".." || name.contains(['/', '\\', '\0']) {
        return Err(GitError::unknown(
            "That folder name looks invalid.".to_string(),
        ));
    }
    Ok(parent.join(name))
}

/// True when `dir` exists and contains no entries.
pub fn is_dir_empty(dir: &Path) -> Result<bool, std::io::Error> {
    Ok(std::fs::read_dir(dir)?.next().is_none())
}

/// Validate an optional `git init -b` branch name. `None`/empty means "use
/// the git default" (`init.defaultBranch` or built-in). Rejects refspec
/// metacharacters so the value is safe as a single argv element.
pub fn validate_init_branch(raw: Option<&str>) -> Result<Option<String>, GitError> {
    let Some(value) = raw else {
        return Ok(None);
    };
    let branch = value.trim();
    if branch.is_empty() {
        return Ok(None);
    }
    if branch.len() > 250
        || branch.starts_with('-')
        || branch.starts_with('.')
        || branch.starts_with('/')
        || branch.ends_with('/')
        || branch.ends_with('.')
        || branch.contains("..")
        || branch.contains("//")
        || branch.contains([
            ' ', '~', '^', ':', '?', '*', '[', '\\', '\0', '\n', '\r', '@', '{',
        ])
    {
        return Err(GitError::unknown(format!(
            "\"{branch}\" is not a valid branch name."
        )));
    }
    Ok(Some(branch.to_string()))
}

/// Scan `root` up to `max_depth` levels for git working trees (a `.git`
/// entry). Depth 0 is the root itself; depth 1 covers its children. Never
/// follows symlinks; skips `node_modules` and nested `.git` internals.
/// Caps results so huge home directories stay responsive.
pub fn discover_repos(root: &Path, max_depth: u8) -> Vec<DiscoveredRepo> {
    const RESULT_CAP: usize = 50;
    let max_depth = max_depth.clamp(0, 3);
    let mut out: Vec<DiscoveredRepo> = Vec::new();
    let mut stack: Vec<(PathBuf, u8)> = vec![(root.to_path_buf(), 0)];
    while let Some((dir, depth)) = stack.pop() {
        if out.len() >= RESULT_CAP {
            break;
        }
        if dir.file_name().is_some_and(|n| n == "node_modules") {
            continue;
        }
        if dir.join(".git").exists() {
            let path = dir.to_string_lossy().into_owned();
            let name = dir
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| path.clone());
            if !out.iter().any(|r| r.path == path) {
                out.push(DiscoveredRepo { path, name });
            }
            // A repo root's children are worktree internals, not new repos.
            continue;
        }
        if depth >= max_depth {
            continue;
        }
        let entries = match std::fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            // Never follow symlinks: discovery must stay under `root`.
            if entry.file_type().is_ok_and(|t| t.is_symlink()) {
                continue;
            }
            if !path.is_dir() {
                continue;
            }
            if path.file_name().is_some_and(|n| {
                n == ".git"
                    || n == "node_modules"
                    || n.to_string_lossy().starts_with('.') && depth > 0
            }) {
                // Allow hidden top-level dirs (e.g. `~/code/.mine`) but skip
                // hidden nesting beyond depth 0 to avoid Library/Caches walks.
                if !(depth == 0 && path.file_name().is_some_and(|n| n != ".git")) {
                    continue;
                }
            }
            stack.push((path, depth + 1));
        }
    }
    out.sort_by(|a, b| a.path.cmp(&b.path));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_https_and_scp_urls() {
        assert!(validate_clone_url("https://github.com/acme/repo.git").is_ok());
        assert!(validate_clone_url("git@github.com:acme/repo.git").is_ok());
        assert!(validate_clone_url("ssh://git@github.com/acme/repo.git").is_ok());
    }

    #[test]
    fn rejects_dangerous_or_malformed_urls() {
        for bad in [
            "",
            "   ",
            "--upload-pack=touch pwned",
            "https://example.com/a b.git",
            "ext::sh -c touch%20pwned",
            "ftp://example.com/repo.git",
            "not-a-url",
            "https://example.com/a;rm -rf ~.git",
            "https://example.com/a$(id).git",
        ] {
            assert!(validate_clone_url(bad).is_err(), "should reject {bad:?}");
        }
    }

    #[test]
    fn derives_repo_names() {
        assert_eq!(
            derive_repo_name("https://github.com/acme/my-repo.git"),
            "my-repo"
        );
        assert_eq!(
            derive_repo_name("git@github.com:acme/my-repo.git"),
            "my-repo"
        );
        assert_eq!(derive_repo_name("https://host/x/"), "x");
    }

    #[test]
    fn rejects_bad_destinations_and_branches() {
        assert!(destination_for_clone(Path::new("/tmp"), "../evil").is_err());
        assert!(destination_for_clone(Path::new("/tmp"), "a/b").is_err());
        assert!(validate_init_branch(Some("main")).unwrap() == Some("main".to_string()));
        assert!(validate_init_branch(None).unwrap().is_none());
        assert!(validate_init_branch(Some("")).unwrap().is_none());
        for bad in ["-main", "..", "a..b", "a b", "a~b", "a:b", "@{1}"] {
            assert!(
                validate_init_branch(Some(bad)).is_err(),
                "should reject {bad:?}"
            );
        }
    }

    #[test]
    fn discovers_nested_repos_without_following_symlinks() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("a").join(".git")).unwrap();
        std::fs::create_dir_all(root.join("b").join("nested").join(".git")).unwrap();
        std::fs::create_dir_all(root.join("plain")).unwrap();
        let found = discover_repos(root, 2);
        let paths: Vec<&Path> = found.iter().map(|r| Path::new(&r.path)).collect();
        assert!(paths.iter().any(|p| p.ends_with("a")));
        assert!(paths.iter().any(|p| p.ends_with("nested")));
        assert_eq!(paths.len(), 2);
    }

    #[test]
    fn discovery_is_depth_capped() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("a").join("b").join("c").join(".git")).unwrap();
        assert!(discover_repos(root, 1).is_empty());
        assert_eq!(discover_repos(root, 3).len(), 1);
    }
}
