use std::path::Path;

use base64::Engine;

use crate::diff::{assert_path_inside_repo, DiffSource};
use crate::git::{git_bytes, git_text, GitError};

/// Max bytes per side before the preview bails out with `tooLarge`.
/// Text diffs cap at 512 KiB; images are useful well beyond that, but
/// data-URL payloads still need a bound. 8 MiB covers photos/screenshots.
pub const MAX_IMAGE_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageSide {
    pub data_url: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImagePreviewResult {
    pub path: String,
    pub mime: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_image: Option<ImageSide>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_image: Option<ImageSide>,
    pub too_large: bool,
}

pub struct ImageFetch {
    pub source: DiffSource,
    pub path: String,
    pub sha: Option<String>,
    pub to_sha: Option<String>,
}

/// Extension → MIME for previewable raster/vector images.
/// Mirrors `isImagePath` in `src/lib/imageFiles.ts` — keep both in sync.
pub fn image_mime(path: &str) -> Option<&'static str> {
    let ext = path.rsplit('.').next()?.to_lowercase();
    // Extensionless names: `rsplit` returns the whole name, which misses
    // every arm below → None. Same outcome as the TS helper.
    match ext.as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "bmp" => Some("image/bmp"),
        "ico" | "cur" => Some("image/x-icon"),
        "avif" => Some("image/avif"),
        "svg" => Some("image/svg+xml"),
        _ => None,
    }
}

fn to_side(mime: &str, bytes: Vec<u8>) -> ImageSide {
    let size_bytes = bytes.len() as u64;
    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
    ImageSide {
        data_url: format!("data:{mime};base64,{encoded}"),
        size_bytes,
    }
}

fn too_large(bytes_len: usize) -> bool {
    bytes_len as u64 > MAX_IMAGE_BYTES
}

async fn read_git_blob(cwd: &Path, spec: &str) -> Option<Vec<u8>> {
    match git_bytes(cwd, &["show", spec]).await {
        Ok((true, bytes)) if !bytes.is_empty() => Some(bytes),
        _ => None,
    }
}

async fn blob_at_rev(cwd: &Path, rev: &str, path: &str) -> Option<Vec<u8>> {
    let spec = format!("{rev}:{path}");
    read_git_blob(cwd, &spec).await
}

async fn commit_parents(cwd: &Path, sha: &str) -> Vec<String> {
    match git_text(cwd, &["rev-list", "--parents", "-n", "1", sha]).await {
        Ok((true, stdout, _)) => stdout
            .split_whitespace()
            .skip(1)
            .map(str::to_string)
            .collect(),
        _ => Vec::new(),
    }
}

fn validate_sha(value: Option<&str>) -> Result<Option<String>, GitError> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    // Refs like `stash@{0}` and `HEAD` are legitimate here; only reject
    // control characters / shell metacharacters since argv is never shelled.
    // `:` separates rev from path in `git show`, so it must not appear.
    if trimmed.contains(['\0', '\n', '\r', ':'])
        || trimmed.len() > 256
        || trimmed.contains("..")
        || trimmed.contains(' ')
    {
        // Hex SHAs (the common case) pass through; anything else suspicious
        // is rejected. Named refs without the above characters (`HEAD`,
        // `main`, `stash@{0}`) are still allowed.
        let is_sha = trimmed.len() <= 40 && trimmed.bytes().all(|b| b.is_ascii_hexdigit());
        let is_named_ref = trimmed.bytes().all(|b| {
            b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'/' | b'@' | b'^' | b'~' | b'{')
        });
        if !is_sha && !is_named_ref {
            return Err(GitError::unknown(format!(
                "Invalid revision \"{trimmed}\"."
            )));
        }
    }
    Ok(Some(trimmed.to_string()))
}

pub async fn fetch_image_preview(
    cwd: &Path,
    req: &ImageFetch,
) -> Result<ImagePreviewResult, GitError> {
    let safe_path = assert_path_inside_repo(&cwd.to_string_lossy(), &req.path)?;
    let Some(mime) = image_mime(&safe_path) else {
        return Err(GitError::unknown("Not an image file.".to_string()));
    };
    let sha = validate_sha(req.sha.as_deref())?;
    let to_sha = validate_sha(req.to_sha.as_deref())?;

    let (old_bytes, new_bytes): (Option<Vec<u8>>, Option<Vec<u8>>) = match req.source {
        DiffSource::Worktree => {
            let old = blob_at_rev(cwd, "HEAD", &safe_path).await;
            let full = cwd.join(&safe_path);
            let current = match tokio::fs::read(&full).await {
                Ok(b) if !b.is_empty() => Some(b),
                _ => None,
            };
            (old, current)
        }
        DiffSource::Index => {
            let old = blob_at_rev(cwd, "HEAD", &safe_path).await;
            let spec = format!(":{safe_path}");
            (old, read_git_blob(cwd, &spec).await)
        }
        DiffSource::Commit => {
            let rev = sha.clone().unwrap_or_else(|| "HEAD".to_string());
            let parents = commit_parents(cwd, &rev).await;
            let old = if let Some(first) = parents.first() {
                blob_at_rev(cwd, first, &safe_path).await
            } else {
                None
            };
            (old, blob_at_rev(cwd, &rev, &safe_path).await)
        }
        DiffSource::Range => {
            let from = sha.clone().unwrap_or_else(|| "HEAD~1".to_string());
            let to = to_sha
                .clone()
                .or(sha.clone())
                .unwrap_or_else(|| "HEAD".to_string());
            let (old, new) = tokio::join!(
                blob_at_rev(cwd, &from, &safe_path),
                blob_at_rev(cwd, &to, &safe_path)
            );
            (old, new)
        }
    };

    if old_bytes.as_ref().is_none_or(|b| too_large(b.len()))
        || new_bytes.as_ref().is_none_or(|b| too_large(b.len()))
    {
        let oversized = old_bytes.as_ref().is_some_and(|b| too_large(b.len()))
            || new_bytes.as_ref().is_some_and(|b| too_large(b.len()));
        if oversized {
            return Ok(ImagePreviewResult {
                path: safe_path,
                mime: mime.to_string(),
                old_image: None,
                new_image: None,
                too_large: true,
            });
        }
    }
    // Both sides missing (e.g. commit doesn't touch the path, or an
    // untracked binary that git can't resolve): surface as empty rather
    // than an error so the panel can fall back to the binary message.
    if old_bytes.is_none() && new_bytes.is_none() {
        return Ok(ImagePreviewResult {
            path: safe_path,
            mime: mime.to_string(),
            old_image: None,
            new_image: None,
            too_large: false,
        });
    }

    Ok(ImagePreviewResult {
        path: safe_path,
        mime: mime.to_string(),
        old_image: old_bytes.map(|b| to_side(mime, b)),
        new_image: new_bytes.map(|b| to_side(mime, b)),
        too_large: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_image_extensions_to_mime() {
        assert_eq!(image_mime("a.png"), Some("image/png"));
        assert_eq!(image_mime("a.JPG"), Some("image/jpeg"));
        assert_eq!(image_mime("a.jpeg"), Some("image/jpeg"));
        assert_eq!(image_mime("a.gif"), Some("image/gif"));
        assert_eq!(image_mime("a.webp"), Some("image/webp"));
        assert_eq!(image_mime("a.svg"), Some("image/svg+xml"));
        assert_eq!(image_mime("a.avif"), Some("image/avif"));
        assert_eq!(image_mime("a.bmp"), Some("image/bmp"));
        assert_eq!(image_mime("a.ico"), Some("image/x-icon"));
        assert_eq!(image_mime("a.zip"), None);
        assert_eq!(image_mime("Makefile"), None);
        assert_eq!(image_mime("a.PNG "), None);
    }

    #[test]
    fn detects_image_paths() {
        assert!(image_mime("img/photo.png").is_some());
        assert!(image_mime("archive.zip").is_none());
    }

    #[test]
    fn encodes_side_as_data_url() {
        let side = to_side("image/png", vec![0x89, 0x50]);
        assert!(side.data_url.starts_with("data:image/png;base64,"));
        assert_eq!(side.size_bytes, 2);
    }

    #[test]
    fn rejects_suspicious_revisions() {
        assert!(validate_sha(Some("abc123")).unwrap() == Some("abc123".to_string()));
        assert!(validate_sha(Some("HEAD")).unwrap() == Some("HEAD".to_string()));
        assert!(validate_sha(Some("stash@{0}")).unwrap() == Some("stash@{0}".to_string()));
        assert!(validate_sha(None).unwrap().is_none());
        assert!(validate_sha(Some("  ")).unwrap().is_none());
        assert!(validate_sha(Some("a:b")).is_err());
        assert!(validate_sha(Some("a b")).is_err());
    }

    #[test]
    fn non_image_preview_is_rejected() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(async {
            let cwd = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
            let err = fetch_image_preview(
                &cwd,
                &ImageFetch {
                    source: DiffSource::Worktree,
                    path: "package.json".to_string(),
                    sha: None,
                    to_sha: None,
                },
            )
            .await
            .expect_err("must fail");
            assert_eq!(err.message, "Not an image file.");
        });
    }

    #[tokio::test]
    async fn previews_real_repo_image_or_empty() {
        let cwd = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let result = fetch_image_preview(
            &cwd,
            &ImageFetch {
                source: DiffSource::Worktree,
                path: "src-tauri/icons/32x32.png".to_string(),
                sha: None,
                to_sha: None,
            },
        )
        .await
        .expect("must not throw");
        assert_eq!(result.mime, "image/png");
        assert!(!result.too_large);
    }
}
