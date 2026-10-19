//! In-app self-update for macOS.
//!
//! Downloads a release asset, verifies its sha256 against the release's
//! CHECKSUMS.txt, extracts the `.app` and swaps it into /Applications after the
//! app exits, then relaunches. Uses incremental system tools (`curl`, `shasum`,
//! `tar`, `codesign`) via argv arrays — no network or crypto crates needed.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

use tauri::AppHandle;

use crate::git::GitError;

const APP_BUNDLE_PROCESS: &str = "Git Light.app/Contents/MacOS/git-light";

#[tauri::command]
pub fn app_self_update(
    asset_url: String,
    expected_sha256: Option<String>,
    app: AppHandle,
) -> Result<(), GitError> {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let work_dir =
        std::env::temp_dir().join(format!("git-light-update-{}-{}", stamp, std::process::id()));

    // Sync phase: download + verify + extract. Everything after this must live in
    // the detached swap script, because we exit the app process below.
    let pkg = prepare_update(&work_dir, &asset_url, expected_sha256.as_deref())?;

    // Detached phase: wait for this app to exit, swap bundles, re-seal, relaunch.
    let script = write_swap_script(&work_dir, &pkg, std::env::temp_dir())
        .map_err(|e| GitError::new("app_self_update_failed", e))?;
    Command::new("/bin/sh")
        .arg(&script)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|e| {
            GitError::new(
                "app_self_update_failed",
                format!("failed to launch swap script: {e}"),
            )
        })?;

    // Give the script a beat to start before exiting the app.
    thread::sleep(Duration::from_millis(300));
    app.exit(0);
    Ok(())
}

/// Warm-up variant used to pre-download without exiting (kept simple: unused for now).
fn run(program: &str, args: &[&str]) -> Result<String, GitError> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|e| GitError::new("app_self_update_failed", format!("{program} failed: {e}")))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(GitError::new(
            "app_self_update_failed",
            format!(
                "{program} exited with {}: {stderr}",
                output.status.code().unwrap_or(-1)
            ),
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn prepare_update(
    work_dir: &Path,
    asset_url: &str,
    expected_sha256: Option<&str>,
) -> Result<PathBuf, GitError> {
    let pkg_dir = work_dir.join("pkg");
    let extract_dir = work_dir.join("extract");
    fs::create_dir_all(&pkg_dir)
        .map_err(|e| GitError::new("app_self_update_failed", format!("mkdir failed: {e}")))?;
    fs::create_dir_all(&extract_dir)
        .map_err(|e| GitError::new("app_self_update_failed", format!("mkdir failed: {e}")))?;

    let pkg_path = pkg_dir.join("update.tar.gz");

    // 1) Download with curl (no quarantine flag attached, unlike browsers).
    run(
        "curl",
        &[
            "-fsSL",
            "--retry",
            "3",
            "-o",
            pkg_path.to_string_lossy().as_ref(),
            asset_url,
        ],
    )?;

    // 2) Verify sha256 against the release's CHECKSUMS.txt entry.
    if let Some(expected) = expected_sha256 {
        let out = run(
            "shasum",
            &["-a", "256", pkg_path.to_string_lossy().as_ref()],
        )?;
        let actual = out.split_whitespace().next().unwrap_or("").to_lowercase();
        if actual != expected.to_lowercase() {
            return Err(GitError::new(
                "app_self_update_failed",
                format!("checksum mismatch: expected {expected}, got {actual}"),
            ));
        }
    }

    // 3) Extract and locate the .app bundle.
    run(
        "tar",
        &[
            "xzf",
            pkg_path.to_string_lossy().as_ref(),
            "-C",
            extract_dir.to_string_lossy().as_ref(),
        ],
    )?;
    let app_path =
        find_app_in(&extract_dir).map_err(|e| GitError::new("app_self_update_failed", e))?;
    Ok(app_path)
}

fn find_app_in(dir: &PathBuf) -> Result<PathBuf, String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("cannot read {dir:?}: {e}"))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e == "app").unwrap_or(false) && path.is_dir() {
            return Ok(path);
        }
    }
    Err("no .app bundle found in the update archive".to_string())
}

fn write_swap_script(work_dir: &Path, new_app: &Path, parent: PathBuf) -> Result<PathBuf, String> {
    let script_path = work_dir.join("swap.sh");
    let target = "/Applications/Git Light.app";
    let script = format!(
        "#!/bin/sh\n\
         # Git Light self-update swap script (generated; do not edit).\n\
         # Waits for the running app to exit, replaces the bundle and relaunches.\n\
         i=0\n\
         while [ \"$i\" -lt 30 ]; do\n\
         \x20 pgrep -f \"{proc}\" >/dev/null 2>&1 || break\n\
         \x20 sleep 1\n\
         \x20 i=$((i+1))\n\
         done\n\
         rm -rf \"{target}\"\n\
         cp -R \"{new_app}\" \"{target}\"\n\
         codesign --force --deep --sign - \"{target}\" >/dev/null 2>&1 || true\n\
         open \"{target}\"\n\
         rm -rf \"{parent}/{work_name}\"\n",
        proc = APP_BUNDLE_PROCESS,
        target = target,
        new_app = new_app.to_string_lossy().replace('"', ""),
        parent = parent.to_string_lossy(),
        work_name = work_dir
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default(),
    );
    fs::write(&script_path, script).map_err(|e| format!("cannot write swap script: {e}"))?;
    Ok(script_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn find_app_detects_app_bundle() {
        let dir = std::env::temp_dir().join(format!("gl-find-app-{}", std::process::id()));
        let app = dir.join("extract").join("Git Light.app");
        fs::create_dir_all(app.join("Contents")).unwrap();
        assert_eq!(find_app_in(&dir.join("extract")).unwrap(), app);
        let empty = dir.join("empty");
        fs::create_dir_all(&empty).unwrap();
        assert!(find_app_in(&empty).is_err());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn swap_script_waits_and_swaps() {
        let dir = std::env::temp_dir().join(format!("gl-swap-{}", std::process::id()));
        let app = dir.join("Git Light.app");
        fs::create_dir_all(&app).unwrap();
        let parent = std::env::temp_dir();
        let script = write_swap_script(&dir, &app, parent).unwrap();
        let content = fs::read_to_string(script).unwrap();
        assert!(content.contains("pgrep -f \"Git Light.app/Contents/MacOS/git-light\""));
        assert!(content.contains("cp -R"));
        assert!(content.contains("open "));
        fs::remove_dir_all(&dir).ok();
    }
}
