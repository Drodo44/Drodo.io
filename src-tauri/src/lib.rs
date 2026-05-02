use serde::Serialize;
use serde_json::json;
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    process::{Command as StdCommand, Stdio},
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::Duration,
    time::UNIX_EPOCH,
};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tokio::{process::Command as TokioCommand, time::timeout};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const N8N_PORT: u16 = 5678;
const N8N_URL: &str = "http://localhost:5678";
const N8N_READY_URL: &str = "http://127.0.0.1:5678/healthz/readiness";
static BOOTSTRAP_IN_FLIGHT: AtomicBool = AtomicBool::new(false);

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

#[derive(Debug, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
struct N8nStatusPayload {
    running: bool,
    url: String,
    port: u16,
    bootstrap_in_progress: bool,
    install_complete: bool,
    last_error_category: Option<String>,
    last_error_message: Option<String>,
    log_path: Option<String>,
    runtime_log_path: Option<String>,
    runtime_error_log_path: Option<String>,
}

#[derive(Debug, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RuntimeStatusFile {
    running: Option<bool>,
    error_category: Option<String>,
    error_message: Option<String>,
    log_path: Option<String>,
    runtime_log_path: Option<String>,
    runtime_error_log_path: Option<String>,
}

fn log_n8n(message: &str) {
    println!("[n8n] {}", message);
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

async fn probe_n8n_running() -> bool {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
    {
        Ok(client) => client,
        Err(_) => return false,
    };

    client
        .get(N8N_READY_URL)
        .send()
        .await
        .map(|response| response.status().is_success())
        .unwrap_or(false)
}

fn default_n8n_status() -> N8nStatusPayload {
    N8nStatusPayload {
        running: false,
        url: N8N_URL.to_string(),
        port: N8N_PORT,
        bootstrap_in_progress: false,
        install_complete: false,
        last_error_category: None,
        last_error_message: None,
        log_path: None,
        runtime_log_path: None,
        runtime_error_log_path: None,
    }
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
        candidates.push(resource_dir.join("_up_").join("scripts").join(file_name));
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

fn repo_root() -> Result<PathBuf, String> {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "Failed to resolve the repository root.".to_string())
}

#[cfg(target_os = "windows")]
fn resolve_windows_automation_home(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        if let Some(parent) = resource_dir.parent() {
            return Ok(parent.join("automation"));
        }
    }

    Ok(repo_root()?.join(".automation").join("windows"))
}

#[cfg(not(target_os = "windows"))]
fn resolve_linux_automation_home(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        return Ok(app_data_dir.join("automation"));
    }

    Ok(repo_root()?.join(".automation").join("linux"))
}

fn resolve_automation_home(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        resolve_windows_automation_home(app)
    }
    #[cfg(not(target_os = "windows"))]
    {
        resolve_linux_automation_home(app)
    }
}

fn resolve_n8n_install_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(app_data) = std::env::var_os("APPDATA") {
            return Ok(PathBuf::from(app_data).join("Drodo").join("n8n"));
        }
    }

    if let Ok(app_data_dir) = app.path().app_data_dir() {
        return Ok(app_data_dir.join("n8n"));
    }

    Ok(resolve_automation_home(app)?.join("data").join("n8n"))
}

fn resolve_n8n_install_marker(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(resolve_n8n_install_dir(app)?.join(".installed"))
}

fn is_n8n_install_complete(app: &tauri::AppHandle) -> bool {
    resolve_n8n_install_marker(app)
        .map(|path| path.exists())
        .unwrap_or(false)
}

fn write_n8n_install_marker(app: &tauri::AppHandle) -> Result<(), String> {
    let marker_path = resolve_n8n_install_marker(app)?;
    if let Some(parent) = marker_path.parent() {
        fs::create_dir_all(parent).map_err(|err| {
            format!(
                "Failed to create n8n install marker directory ({}): {}",
                stringify_path(parent),
                err
            )
        })?;
    }
    fs::write(&marker_path, b"").map_err(|err| {
        format!(
            "Failed to write n8n install marker ({}): {}",
            stringify_path(&marker_path),
            err
        )
    })?;
    Ok(())
}

fn resolve_n8n_bootstrap_log_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(resolve_automation_home(app)?
        .join("logs")
        .join("bootstrap.log"))
}

fn read_last_lines(path: &Path, max_lines: usize) -> Vec<String> {
    let Ok(raw) = fs::read_to_string(path) else {
        return Vec::new();
    };
    let mut lines = raw
        .lines()
        .map(ToString::to_string)
        .collect::<Vec<String>>();
    if lines.len() > max_lines {
        lines = lines.split_off(lines.len() - max_lines);
    }
    lines
}

fn append_n8n_bootstrap_log(log_path: &Path, message: &str) {
    let line = format!("{} [rust] {}\n", chrono_like_timestamp(), message);
    let _ = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .and_then(|mut file| std::io::Write::write_all(&mut file, line.as_bytes()));
}

fn chrono_like_timestamp() -> String {
    std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| format!("unix:{}", duration.as_secs()))
        .unwrap_or_else(|_| "unix:0".to_string())
}

fn read_runtime_status_from_disk(app: &tauri::AppHandle) -> Option<RuntimeStatusFile> {
    let automation_home = resolve_automation_home(app).ok()?;
    let status_path = automation_home.join("n8n-status.json");
    let raw = fs::read_to_string(status_path).ok()?;
    serde_json::from_str::<RuntimeStatusFile>(&raw).ok()
}

fn build_n8n_status_for_app(
    app: &tauri::AppHandle,
    probe_running: bool,
    bootstrap_in_progress: bool,
) -> N8nStatusPayload {
    let mut payload = default_n8n_status();
    payload.bootstrap_in_progress = bootstrap_in_progress;
    payload.install_complete = is_n8n_install_complete(app);

    if let Some(file_status) = read_runtime_status_from_disk(app) {
        payload.running = file_status.running.unwrap_or(false);
        payload.last_error_category = file_status.error_category;
        payload.last_error_message = file_status.error_message;
        payload.log_path = file_status.log_path;
        payload.runtime_log_path = file_status.runtime_log_path;
        payload.runtime_error_log_path = file_status.runtime_error_log_path;
    }

    payload.running = probe_running || payload.running;
    payload
}

fn spawn_dependency_bootstrap(app: &tauri::AppHandle) -> Result<(), String> {
    log_n8n("Bootstrap requested.");
    log_n8n(
        "Expecting iframe-compatible n8n auth cookies from bootstrap runtime: N8N_SAMESITE_COOKIE=none, N8N_SECURE_COOKIE=true.",
    );

    let script_path = resolve_dependency_script_path(app)?;
    log_n8n(&format!(
        "Resolved bootstrap script path: {}",
        stringify_path(&script_path)
    ));
    let automation_home = resolve_automation_home(app)?;
    log_n8n(&format!(
        "Resolved automation home: {}",
        stringify_path(&automation_home)
    ));
    let app_version = app.package_info().version.to_string();
    let app_handle = app.clone();
    let bootstrap_log_path = resolve_n8n_bootstrap_log_path(app)?;
    if let Some(parent) = bootstrap_log_path.parent() {
        fs::create_dir_all(parent).map_err(|err| {
            format!(
                "Failed to create bootstrap log directory ({}): {}",
                stringify_path(parent),
                err
            )
        })?;
    }

    thread::spawn(move || {
        append_n8n_bootstrap_log(
            &bootstrap_log_path,
            &format!(
                "Launching dependency bootstrap script: {}",
                stringify_path(&script_path)
            ),
        );

        #[cfg(target_os = "windows")]
        let mut command = {
            let mut command = StdCommand::new("powershell");
            command
                .args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    &stringify_path(&script_path),
                ])
                .creation_flags(CREATE_NO_WINDOW);
            command
        };

        #[cfg(not(target_os = "windows"))]
        let mut command = {
            let mut command = StdCommand::new("sh");
            command.arg(&script_path);
            command
        };

        let stdout = match fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&bootstrap_log_path)
        {
            Ok(file) => file,
            Err(err) => {
                log_n8n(&format!(
                    "Failed to open bootstrap log for stdout redirection ({}): {}",
                    stringify_path(&bootstrap_log_path),
                    err
                ));
                BOOTSTRAP_IN_FLIGHT.store(false, Ordering::SeqCst);
                return;
            }
        };
        let stderr = match stdout.try_clone() {
            Ok(file) => file,
            Err(err) => {
                log_n8n(&format!(
                    "Failed to clone bootstrap log for stderr redirection ({}): {}",
                    stringify_path(&bootstrap_log_path),
                    err
                ));
                BOOTSTRAP_IN_FLIGHT.store(false, Ordering::SeqCst);
                return;
            }
        };

        let status = command
            .env("DRODO_AUTOMATION_HOME", stringify_path(&automation_home))
            .env("DRODO_APP_VERSION", app_version)
            .env("DRODO_BOOTSTRAP_LOG_PATH", stringify_path(&bootstrap_log_path))
            .stdout(Stdio::from(stdout))
            .stderr(Stdio::from(stderr))
            .status();

        match status {
            Ok(status) if status.success() => {
                log_n8n("Dependency bootstrap script completed successfully.");
                append_n8n_bootstrap_log(
                    &bootstrap_log_path,
                    "Dependency bootstrap process exited successfully.",
                );
                if let Err(err) = write_n8n_install_marker(&app_handle) {
                    log_n8n(&format!("{err}"));
                    append_n8n_bootstrap_log(&bootstrap_log_path, &err);
                } else {
                    log_n8n("n8n install marker written.");
                    append_n8n_bootstrap_log(&bootstrap_log_path, "n8n install marker written.");
                }
            }
            Ok(status) => {
                let message = format!(
                    "Dependency bootstrap script failed with status: {}",
                    status
                );
                log_n8n(&message);
                append_n8n_bootstrap_log(&bootstrap_log_path, &message);
            }
            Err(err) => {
                let message = format!("Dependency bootstrap script failed to run: {err}");
                log_n8n(&message);
                append_n8n_bootstrap_log(&bootstrap_log_path, &message);
            }
        }

        BOOTSTRAP_IN_FLIGHT.store(false, Ordering::SeqCst);
    });
    log_n8n("Bootstrap process spawned in background.");

    Ok(())
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let path = path_from_input(&path)?;
    let bytes = fs::read(&path)
        .map_err(|err| format!("Failed to read {}: {}", stringify_path(&path), err))?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[tauri::command]
async fn pick_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let picked = app
        .dialog()
        .file()
        .blocking_pick_files()
        .unwrap_or_default();

    picked
        .into_iter()
        .map(|file_path| {
            file_path
                .into_path()
                .map(|path| stringify_path(&path))
                .map_err(|err| format!("Failed to resolve a selected file path: {err}"))
        })
        .collect()
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    let path = path_from_input(&path)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| {
            format!(
                "Failed to create parent directories for {}: {}",
                stringify_path(&path),
                err
            )
        })?;
    }
    fs::write(&path, content)
        .map_err(|err| format!("Failed to write {}: {}", stringify_path(&path), err))?;
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
                size: if metadata.is_file() {
                    Some(metadata.len())
                } else {
                    None
                },
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
async fn execute_command(command: String) -> Result<CommandExecutionResult, String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("Command cannot be empty.".to_string());
    }

    #[cfg(target_os = "windows")]
    let (shell, output) = {
        let shell = "cmd";
        let mut command = TokioCommand::new(shell);
        command.kill_on_drop(true);
        let output = timeout(
            Duration::from_secs(300),
            command.args(["/C", trimmed]).output(),
        )
        .await
        .map_err(|_| format!("Command timed out after 300 seconds: {trimmed}"))?
        .map_err(|err| format!("Failed to execute command: {}", err))?;
        (shell.to_string(), output)
    };

    #[cfg(not(target_os = "windows"))]
    let (shell, output) = {
        let shell = "sh";
        let mut command = TokioCommand::new(shell);
        command.kill_on_drop(true);
        let output = timeout(
            Duration::from_secs(300),
            command.args(["-lc", trimmed]).output(),
        )
        .await
        .map_err(|_| format!("Command timed out after 300 seconds: {trimmed}"))?
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
        StdCommand::new("powershell")
            .args(["-NoProfile", "-Command", trimmed])
            .envs(&env_vars)
            .spawn()
            .map_err(|err| format!("Failed to start MCP server: {}", err))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        StdCommand::new("sh")
            .args(["-c", trimmed])
            .envs(&env_vars)
            .spawn()
            .map_err(|err| format!("Failed to start MCP server: {}", err))?;
    }

    Ok(())
}

#[tauri::command]
async fn get_n8n_status(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let running = probe_n8n_running().await;
    let status =
        build_n8n_status_for_app(&app, running, BOOTSTRAP_IN_FLIGHT.load(Ordering::SeqCst));
    log_n8n(&format!(
        "Status requested: running={}, in_flight={}, last_error={}",
        status.running,
        status.bootstrap_in_progress,
        status.last_error_message.as_deref().unwrap_or("none")
    ));
    Ok(json!(status))
}

#[tauri::command]
fn get_n8n_install_log(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let log_path = resolve_n8n_bootstrap_log_path(&app)?;
    Ok(read_last_lines(&log_path, 50))
}

#[tauri::command]
fn start_dependency_bootstrap(app: tauri::AppHandle) -> Result<(), String> {
    if BOOTSTRAP_IN_FLIGHT.load(Ordering::SeqCst) {
        log_n8n("Bootstrap already in flight; skipping duplicate request.");
        return Ok(());
    }

    let is_running = tauri::async_runtime::block_on(probe_n8n_running());
    if is_running {
        log_n8n("n8n already healthy; skipping bootstrap.");
        if !is_n8n_install_complete(&app) {
            write_n8n_install_marker(&app)?;
        }
        return Ok(());
    }

    BOOTSTRAP_IN_FLIGHT.store(true, Ordering::SeqCst);
    if let Err(err) = spawn_dependency_bootstrap(&app) {
        BOOTSTRAP_IN_FLIGHT.store(false, Ordering::SeqCst);
        log_n8n(&format!("Bootstrap spawn failed: {err}"));
        return Err(err);
    }

    log_n8n("Bootstrap handoff completed.");

    Ok(())
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
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if is_n8n_install_complete(app.handle()) {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(err) = start_dependency_bootstrap(app_handle) {
                        log_n8n(&format!("Bootstrap spawn during app setup failed: {err}"));
                    }
                });
            } else {
                log_n8n("n8n install marker not found; waiting for user-initiated setup.");
            }

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            pick_files,
            write_file,
            list_directory,
            execute_command,
            get_home_dir,
            get_n8n_status,
            get_n8n_install_log,
            start_dependency_bootstrap,
            start_mcp_server
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
