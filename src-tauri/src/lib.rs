use serde::Serialize;
use serde_json::json;
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::Duration,
    time::UNIX_EPOCH,
};
use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const N8N_PORT: u16 = 5678;
const N8N_URL: &str = "http://localhost:5678";

#[cfg(target_os = "windows")]
const DETACHED_PROCESS: u32 = 0x0000_0008;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

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

fn probe_n8n_running() -> bool {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .and_then(|client| client.head(N8N_URL).send())
        .is_ok()
}

fn build_n8n_status(running: bool) -> serde_json::Value {
    json!({
        "running": running,
        "url": N8N_URL,
        "port": N8N_PORT,
    })
}

fn resolve_dependency_script_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let file_name = if cfg!(target_os = "windows") {
        "install-dependencies.ps1"
    } else {
        "install-dependencies.sh"
    };

    let mut candidates = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join(file_name));
        candidates.push(resource_dir.join("scripts").join(file_name));
    }

    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "Failed to resolve the repository root.".to_string())?;
    candidates.push(repo_root.join("scripts").join(file_name));

    candidates
        .into_iter()
        .find(|candidate| candidate.exists())
        .ok_or_else(|| format!("Unable to locate the dependency bootstrap script: {file_name}"))
}

fn spawn_dependency_bootstrap(app: &tauri::AppHandle) -> Result<(), String> {
    let script_path = resolve_dependency_script_path(app)?;

    #[cfg(target_os = "windows")]
    {
        let mut command = Command::new("powershell");
        command
            .args([
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                &stringify_path(&script_path),
            ])
            .creation_flags(DETACHED_PROCESS | CREATE_NO_WINDOW);

        command
            .spawn()
            .map_err(|err| format!("Failed to start the dependency bootstrapper: {err}"))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new("sh")
            .arg(&script_path)
            .spawn()
            .map_err(|err| format!("Failed to start the dependency bootstrapper: {err}"))?;
    }

    Ok(())
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

/// Spawn an MCP server process with the given command and environment variables.
/// Credentials from localStorage are passed as env vars so they never touch the
/// Drodo network — they only exist locally in the spawned child process.
#[tauri::command]
fn start_mcp_server(
    _server_id: String,
    command: String,
    env_vars: HashMap<String, String>,
) -> Result<(), String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("MCP server command cannot be empty.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("powershell")
            .args(["-NoProfile", "-Command", trimmed])
            .envs(&env_vars)
            .spawn()
            .map_err(|err| format!("Failed to start MCP server: {}", err))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new("sh")
            .args(["-c", trimmed])
            .envs(&env_vars)
            .spawn()
            .map_err(|err| format!("Failed to start MCP server: {}", err))?;
    }

    Ok(())
}

#[tauri::command]
fn get_n8n_status() -> Result<serde_json::Value, String> {
    Ok(build_n8n_status(probe_n8n_running()))
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
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if !probe_n8n_running() {
                    if let Err(err) = spawn_dependency_bootstrap(&app_handle) {
                        eprintln!("{err}");
                    }
                }
            });

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            list_directory,
            execute_command,
            get_home_dir,
            get_n8n_status,
            start_mcp_server
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
