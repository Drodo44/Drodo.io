use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::UNIX_EPOCH,
};
use tauri::Manager;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DirectoryEntry {
    name: String,
    path: String,
    is_directory: bool,
    size: Option<u64>,
    modified_at: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommandExecutionResult {
    command: String,
    shell: String,
    working_directory: String,
    stdout: String,
    stderr: String,
    combined: String,
    exit_code: i32,
    success: bool,
}

fn path_from_input(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path cannot be empty.".to_string());
    }
    Ok(PathBuf::from(trimmed))
}

fn stringify_path(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let path = path_from_input(&path)?;
    let bytes = fs::read(&path).map_err(|err| format!("Failed to read {}: {}", stringify_path(&path), err))?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    let path = path_from_input(&path)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create parent directories for {}: {}", stringify_path(&path), err))?;
    }
    fs::write(&path, content).map_err(|err| format!("Failed to write {}: {}", stringify_path(&path), err))?;
    Ok(())
}

#[tauri::command]
fn list_directory(path: String) -> Result<Vec<DirectoryEntry>, String> {
    let path = path_from_input(&path)?;
    let mut entries = fs::read_dir(&path)
        .map_err(|err| format!("Failed to list {}: {}", stringify_path(&path), err))?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;
            let modified_at = metadata
                .modified()
                .ok()
                .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_secs());
            Some(DirectoryEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                path: stringify_path(&entry.path()),
                is_directory: metadata.is_dir(),
                size: if metadata.is_file() { Some(metadata.len()) } else { None },
                modified_at,
            })
        })
        .collect::<Vec<_>>();

    entries.sort_by(|left, right| {
        right
            .is_directory
            .cmp(&left.is_directory)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });

    Ok(entries)
}

#[tauri::command]
fn execute_command(command: String) -> Result<CommandExecutionResult, String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("Command cannot be empty.".to_string());
    }

    #[cfg(target_os = "windows")]
    let (shell, output) = {
        let shell = "powershell";
        let output = Command::new(shell)
            .args(["-NoProfile", "-Command", trimmed])
            .output()
            .map_err(|err| format!("Failed to execute command: {}", err))?;
        (shell.to_string(), output)
    };

    #[cfg(not(target_os = "windows"))]
    let (shell, output) = {
        let shell = "sh";
        let output = Command::new(shell)
            .args(["-lc", trimmed])
            .output()
            .map_err(|err| format!("Failed to execute command: {}", err))?;
        (shell.to_string(), output)
    };

    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    let combined = match (stdout.trim().is_empty(), stderr.trim().is_empty()) {
        (false, false) => format!("{}\n{}", stdout, stderr),
        (false, true) => stdout.clone(),
        (true, false) => stderr.clone(),
        (true, true) => String::new(),
    };

    Ok(CommandExecutionResult {
        command: trimmed.to_string(),
        shell,
        working_directory: std::env::current_dir()
            .map(|cwd| stringify_path(&cwd))
            .unwrap_or_default(),
        stdout,
        stderr,
        combined,
        exit_code: output.status.code().unwrap_or(-1),
        success: output.status.success(),
    })
}

#[tauri::command]
fn get_home_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .home_dir()
        .map(|path: std::path::PathBuf| stringify_path(&path))
        .map_err(|err| format!("Failed to resolve the home directory: {}", err))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            list_directory,
            execute_command,
            get_home_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
