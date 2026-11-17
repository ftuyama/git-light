//! Embedded terminal sessions backed by a real PTY.
//!
//! The frontend (xterm.js) asks for a session in the current repository
//! folder, then streams keystrokes through `terminal_write` and receives the
//! shell's output as `terminal:data` events. Output is base64-encoded because
//! a PTY read can split a multi-byte UTF-8 sequence across chunks.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::{Arc, Mutex};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::git::GitError;

const DEFAULT_COLS: u16 = 80;
const DEFAULT_ROWS: u16 = 24;
const MAX_DIMENSION: u16 = 1000;

struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

/// Managed Tauri state. The map itself sits behind an `Arc` so a spawned
/// reader thread can outlive the command call without borrowing app state.
#[derive(Clone, Default)]
pub struct TerminalState {
    sessions: Arc<Mutex<HashMap<String, Session>>>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalDataEvent {
    id: String,
    data: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalExitEvent {
    id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionInfo {
    pub id: String,
    /// Absolute path of the shell that was started, shown in the tab label.
    pub shell: String,
}

fn clamp_dimension(value: u16) -> u16 {
    value.clamp(1, MAX_DIMENSION)
}

/// Existing shell executable to launch, falling back to a platform default.
fn shell_program() -> String {
    if cfg!(windows) {
        if let Ok(comspec) = std::env::var("COMSPEC") {
            if Path::new(&comspec).is_file() {
                return comspec;
            }
        }
        return "cmd.exe".to_string();
    }
    if let Ok(shell) = std::env::var("SHELL") {
        if Path::new(&shell).is_file() {
            return shell;
        }
    }
    "/bin/sh".to_string()
}

/// A directory the terminal may start in. It must exist and be a directory;
/// anything else falls back to the caller-provided repository path, which is
/// expected to be validated by the repository store already.
fn checked_cwd(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    let path = Path::new(trimmed);
    if path.is_dir() {
        Some(trimmed.to_string())
    } else {
        None
    }
}

fn base_name(path: &str) -> String {
    path.rsplit(['/', '\\'])
        .find(|part| !part.is_empty())
        .unwrap_or(path)
        .to_string()
}

#[tauri::command]
pub async fn terminal_open(
    app: AppHandle,
    state: State<'_, TerminalState>,
    cwd: String,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<TerminalSessionInfo, GitError> {
    let Some(cwd) = checked_cwd(&cwd) else {
        return Err(GitError::new(
            "InvalidPath",
            "The terminal working directory does not exist.".to_string(),
        ));
    };
    let cols = clamp_dimension(cols.unwrap_or(DEFAULT_COLS));
    let rows = clamp_dimension(rows.unwrap_or(DEFAULT_ROWS));
    let sessions = Arc::clone(&state.sessions);
    let id = uuid::Uuid::new_v4().to_string();

    // Opening a PTY and forking the shell blocks briefly; keep it off the
    // async runtime and off the main thread.
    let result =
        tauri::async_runtime::spawn_blocking(move || {
            let shell = shell_program();
            let pty_system = native_pty_system();
            let pair = pty_system
                .openpty(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|err| GitError::new("Unknown", format!("Could not open a PTY: {err}")))?;

            let mut command = CommandBuilder::new(&shell);
            if !cfg!(windows) {
                // Login shell so the user's regular PATH and aliases are present.
                command.arg("-l");
            }
            command.cwd(&cwd);
            command.env("TERM", "xterm-256color");
            command.env("COLORTERM", "truecolor");
            command.env("TERM_PROGRAM", "Git Light");

            let child = pair.slave.spawn_command(command).map_err(|err| {
                GitError::new("Unknown", format!("Could not start {shell}: {err}"))
            })?;
            // The slave side must be dropped in this process, otherwise the reader
            // never sees EOF after the shell exits.
            drop(pair.slave);

            let mut reader = pair.master.try_clone_reader().map_err(|err| {
                GitError::new("Unknown", format!("Could not read the PTY: {err}"))
            })?;
            let writer = pair.master.take_writer().map_err(|err| {
                GitError::new("Unknown", format!("Could not write to the PTY: {err}"))
            })?;

            let session = Session {
                master: pair.master,
                writer,
                child,
            };
            sessions
                .lock()
                .map_err(|_| GitError::unknown("Terminal state is unavailable.".to_string()))?
                .insert(id.clone(), session);

            let event_id = id.clone();
            let event_app = app.clone();
            std::thread::spawn(move || {
                let mut buffer = [0u8; 16 * 1024];
                loop {
                    match reader.read(&mut buffer) {
                        Ok(0) | Err(_) => break,
                        Ok(count) => {
                            let event = TerminalDataEvent {
                                id: event_id.clone(),
                                data: STANDARD.encode(&buffer[..count]),
                            };
                            if event_app.emit("terminal:data", event).is_err() {
                                break;
                            }
                        }
                    }
                }
                let _ = event_app.emit(
                    "terminal:exit",
                    TerminalExitEvent {
                        id: event_id.clone(),
                    },
                );
            });

            Ok(TerminalSessionInfo {
                id,
                shell: base_name(&shell),
            })
        })
        .await
        .map_err(|err| GitError::unknown(format!("Terminal task failed: {err}")))?;

    result
}

#[tauri::command]
pub fn terminal_write(
    state: State<'_, TerminalState>,
    id: String,
    data: String,
) -> Result<(), GitError> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| GitError::unknown("Terminal state is unavailable.".to_string()))?;
    let session = sessions
        .get_mut(&id)
        .ok_or_else(|| GitError::new("Unknown", "Terminal session is closed.".to_string()))?;
    session
        .writer
        .write_all(data.as_bytes())
        .and_then(|_| session.writer.flush())
        .map_err(|err| GitError::unknown(format!("Could not write to the terminal: {err}")))
}

#[tauri::command]
pub fn terminal_resize(
    state: State<'_, TerminalState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), GitError> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| GitError::unknown("Terminal state is unavailable.".to_string()))?;
    let session = sessions
        .get(&id)
        .ok_or_else(|| GitError::new("Unknown", "Terminal session is closed.".to_string()))?;
    session
        .master
        .resize(PtySize {
            rows: clamp_dimension(rows),
            cols: clamp_dimension(cols),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| GitError::unknown(format!("Could not resize the terminal: {err}")))
}

#[tauri::command]
pub fn terminal_close(state: State<'_, TerminalState>, id: String) -> Result<(), GitError> {
    let session = state
        .sessions
        .lock()
        .map_err(|_| GitError::unknown("Terminal state is unavailable.".to_string()))?
        .remove(&id);
    if let Some(mut session) = session {
        let _ = session.child.kill();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamps_terminal_dimensions() {
        assert_eq!(clamp_dimension(0), 1);
        assert_eq!(clamp_dimension(120), 120);
        assert_eq!(clamp_dimension(u16::MAX), MAX_DIMENSION);
    }

    #[test]
    fn rejects_missing_or_empty_cwd() {
        assert!(checked_cwd("").is_none());
        assert!(checked_cwd("   ").is_none());
        assert!(checked_cwd("/definitely/not/a/real/directory").is_none());
        assert!(checked_cwd(env!("CARGO_MANIFEST_DIR")).is_some());
    }

    #[test]
    fn shell_program_is_an_existing_file() {
        let shell = shell_program();
        assert!(Path::new(&shell).is_file(), "unexpected shell: {shell}");
    }

    #[test]
    fn base_name_handles_posix_and_windows_paths() {
        assert_eq!(base_name("/bin/zsh"), "zsh");
        assert_eq!(base_name("C:\\Windows\\System32\\cmd.exe"), "cmd.exe");
        assert_eq!(base_name(""), "");
    }

    /// End-to-end sanity check for the PTY wiring: start a shell in a known
    /// directory and confirm its output comes back through the master side.
    #[cfg(unix)]
    #[test]
    fn pty_shell_starts_in_requested_directory() {
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .expect("open pty");
        let mut command = CommandBuilder::new(shell_program());
        command.args(["-l", "-c", "pwd"]);
        command.cwd(env!("CARGO_MANIFEST_DIR"));
        command.env("TERM", "dumb");
        let mut child = pair.slave.spawn_command(command).expect("spawn shell");
        drop(pair.slave);

        let mut reader = pair.master.try_clone_reader().expect("reader");
        let mut output = Vec::new();
        let mut buffer = [0u8; 4096];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(count) => output.extend_from_slice(&buffer[..count]),
            }
        }
        let _ = child.wait();

        let text = String::from_utf8_lossy(&output);
        assert!(
            text.contains("src-tauri"),
            "shell did not start in the requested directory: {text}"
        );
    }
}
