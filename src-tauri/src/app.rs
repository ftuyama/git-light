//! Application-level commands that act on the whole process.

/// Relaunch the application. Tauri tears down and starts a fresh process.
#[tauri::command]
pub fn app_relaunch(app: tauri::AppHandle) {
    app.restart()
}
