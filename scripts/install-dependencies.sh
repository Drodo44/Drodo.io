#!/usr/bin/env bash

set -euo pipefail

REPO_OWNER="Drodo44"
REPO_NAME="Drodo.io"
REQUIRED_FREE_SPACE_BYTES=$((5 * 1024 * 1024 * 1024))
N8N_PORT=5678
N8N_URL="http://127.0.0.1:${N8N_PORT}"
N8N_READY_URL="${N8N_URL}/healthz/readiness"
N8N_READY_TIMEOUT_SECONDS=5
N8N_STARTUP_TIMEOUT_SECONDS=600
N8N_STARTUP_INTERVAL_SECONDS=5

resolve_repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

resolve_automation_home() {
  if [[ -n "${DRODO_AUTOMATION_HOME:-}" ]]; then
    printf '%s\n' "$DRODO_AUTOMATION_HOME"
    return
  fi

  printf '%s\n' "${XDG_DATA_HOME:-$HOME/.local/share}/Drodo/automation"
}

AUTOMATION_HOME="$(resolve_automation_home)"
AUTOMATION_LOGS_DIR="$AUTOMATION_HOME/logs"
AUTOMATION_DOWNLOADS_DIR="$AUTOMATION_HOME/downloads"
AUTOMATION_TEMP_DIR="$AUTOMATION_HOME/tmp"
AUTOMATION_DATA_DIR="$AUTOMATION_HOME/data"
STATUS_FILE="$AUTOMATION_HOME/n8n-status.json"
LAST_ERROR_FILE="$AUTOMATION_HOME/last-error.txt"
LOG_FILE="$AUTOMATION_LOGS_DIR/bootstrap.log"
RUNTIME_LOG_FILE="$AUTOMATION_LOGS_DIR/n8n-runtime.out.log"
RUNTIME_ERR_LOG_FILE="$AUTOMATION_LOGS_DIR/n8n-runtime.err.log"
MANIFEST_PATH="$AUTOMATION_HOME/manifest.json"
PID_FILE="$AUTOMATION_HOME/n8n.pid"

mkdir -p "$AUTOMATION_LOGS_DIR" "$AUTOMATION_DOWNLOADS_DIR" "$AUTOMATION_TEMP_DIR"

log() {
  printf '%s %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$1" >>"$LOG_FILE"
}

save_status() {
  local running="$1"
  local started_at="${2:-null}"
  local error_category="${3:-null}"
  local error_message="${4:-null}"

  cat >"$STATUS_FILE" <<EOF
{
  "running": $running,
  "url": "$N8N_URL",
  "port": $N8N_PORT,
  "startedAt": $started_at,
  "logPath": "$LOG_FILE",
  "runtimeLogPath": "$RUNTIME_LOG_FILE",
  "runtimeErrorLogPath": "$RUNTIME_ERR_LOG_FILE",
  "errorCategory": $error_category,
  "errorMessage": $error_message
}
EOF
}

save_last_error() {
  local category="$1"
  local message="$2"
  cat >"$LAST_ERROR_FILE" <<EOF
$category
$message
$LOG_FILE
EOF
}

clear_last_error() {
  rm -f "$LAST_ERROR_FILE"
}

json_string_or_null() {
  if [[ -n "${1:-}" ]]; then
    printf '"%s"' "${1//\"/\\\"}"
  else
    printf 'null'
  fi
}

read_version_from_json() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    return 1
  fi
  sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$path" | head -n1
}

resolve_app_version() {
  if [[ -n "${DRODO_APP_VERSION:-}" ]]; then
    printf '%s\n' "$DRODO_APP_VERSION"
    return
  fi

  local repo_root
  repo_root="$(resolve_repo_root)"

  local version
  version="$(read_version_from_json "$repo_root/src-tauri/tauri.conf.json" || true)"
  if [[ -n "$version" ]]; then
    printf '%s\n' "$version"
    return
  fi

  version="$(read_version_from_json "$repo_root/package.json" || true)"
  if [[ -n "$version" ]]; then
    printf '%s\n' "$version"
    return
  fi

  echo "Unable to determine the Drodo application version for runtime bootstrap." >&2
  return 1
}

APP_VERSION="$(resolve_app_version)"
EXPECTED_PLATFORM="linux-x64"
RUNTIME_ASSET_NAME="drodo-runtime-${EXPECTED_PLATFORM}-${APP_VERSION}.tar.gz"
RUNTIME_CHECKSUM_NAME="${RUNTIME_ASSET_NAME}.sha256"

default_runtime_base_url() {
  printf 'https://github.com/%s/%s/releases/download/v%s\n' "$REPO_OWNER" "$REPO_NAME" "$APP_VERSION"
}

resolve_runtime_asset_url() {
  if [[ -n "${DRODO_AUTOMATION_RUNTIME_URL:-}" ]]; then
    printf '%s\n' "$DRODO_AUTOMATION_RUNTIME_URL"
    return
  fi

  local base_url="${DRODO_RUNTIME_BASE_URL:-$(default_runtime_base_url)}"
  printf '%s/%s\n' "${base_url%/}" "$RUNTIME_ASSET_NAME"
}

resolve_runtime_checksum_url() {
  printf '%s.sha256\n' "$(resolve_runtime_asset_url)"
}

resolve_local_runtime_candidate() {
  if [[ -n "${DRODO_AUTOMATION_RUNTIME_PATH:-}" && -e "${DRODO_AUTOMATION_RUNTIME_PATH:-}" ]]; then
    printf '%s\n' "$DRODO_AUTOMATION_RUNTIME_PATH"
    return
  fi

  local repo_root
  repo_root="$(resolve_repo_root)"

  for candidate in \
    "$repo_root/artifacts/runtime/$RUNTIME_ASSET_NAME" \
    "$HOME/.local/share/Drodo/runtime-assets/$RUNTIME_ASSET_NAME" \
    "/var/lib/Drodo/runtime-assets/$RUNTIME_ASSET_NAME"; do
    if [[ -e "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return
    fi
  done
}

ensure_sufficient_disk_space() {
  local available
  available="$(df -Pk "$AUTOMATION_HOME" | awk 'NR==2 {print $4 * 1024}')"
  if [[ "$available" -lt "$REQUIRED_FREE_SPACE_BYTES" ]]; then
    local available_gb required_gb
    available_gb="$(awk "BEGIN {printf \"%.2f\", $available / 1073741824}")"
    required_gb="$(awk "BEGIN {printf \"%.2f\", $REQUIRED_FREE_SPACE_BYTES / 1073741824}")"
    echo "Insufficient disk space for Drodo automation runtime. Required ${required_gb} GB free, found ${available_gb} GB." >&2
    return 1
  fi
}

download_file() {
  local url="$1"
  local destination="$2"
  log "Downloading $url to $destination."

  if command -v curl >/dev/null 2>&1; then
    curl -fL -C - -o "$destination" "$url"
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -c -O "$destination" "$url"
    return
  fi

  echo "Neither curl nor wget is available to download $url." >&2
  return 1
}

read_expected_checksum() {
  local checksum_path="$1"
  awk '{print $1}' "$checksum_path" | head -n1
}

verify_checksum() {
  local file_path="$1"
  local checksum_path="$2"
  local expected actual

  expected="$(read_expected_checksum "$checksum_path")"
  if [[ -z "$expected" ]]; then
    echo "Checksum file $checksum_path does not contain a valid SHA256 checksum." >&2
    return 1
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$file_path" | awk '{print $1}')"
  else
    actual="$(shasum -a 256 "$file_path" | awk '{print $1}')"
  fi

  if [[ "$expected" != "$actual" ]]; then
    echo "Checksum verification failed for $file_path." >&2
    return 1
  fi

  log "Checksum verification succeeded for $file_path."
}

resolve_runtime_source() {
  local local_candidate
  local_candidate="$(resolve_local_runtime_candidate || true)"
  if [[ -n "$local_candidate" ]]; then
    log "Using local runtime source at $local_candidate."
    printf '%s\n' "$local_candidate"
    return
  fi

  local asset_path checksum_path
  asset_path="$AUTOMATION_DOWNLOADS_DIR/$RUNTIME_ASSET_NAME"
  checksum_path="$AUTOMATION_DOWNLOADS_DIR/$RUNTIME_CHECKSUM_NAME"
  download_file "$(resolve_runtime_asset_url)" "$asset_path"
  download_file "$(resolve_runtime_checksum_url)" "$checksum_path"
  verify_checksum "$asset_path" "$checksum_path"
  printf '%s\n' "$asset_path"
}

manifest_matches_expected() {
  [[ -f "$MANIFEST_PATH" ]] || return 1
  grep -q "\"runtimeVersion\": \"$APP_VERSION\"" "$MANIFEST_PATH" || return 1
  grep -q "\"platform\": \"$EXPECTED_PLATFORM\"" "$MANIFEST_PATH" || return 1
  [[ -x "$AUTOMATION_HOME/node/bin/node" ]] || return 1
  [[ -f "$AUTOMATION_HOME/prefix/lib/node_modules/n8n/bin/n8n" ]] || return 1
  return 0
}

copy_runtime_tree() {
  local source="$1"
  local destination="$2"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$source"/ "$destination"/
    return
  fi

  mkdir -p "$destination"
  cp -a "$source"/. "$destination"/
}

materialize_runtime() {
  local source_path="$1"
  local staging_dir backup_dir
  staging_dir="${AUTOMATION_HOME}.staging"
  backup_dir="${AUTOMATION_HOME}.backup"

  rm -rf "$staging_dir" "$backup_dir"
  mkdir -p "$staging_dir"

  if [[ -d "$source_path" ]]; then
    log "Copying runtime directory from $source_path to staging."
    copy_runtime_tree "$source_path" "$staging_dir"
  else
    log "Extracting runtime archive $source_path to staging."
    tar -xzf "$source_path" -C "$staging_dir"
  fi

  if [[ -d "$AUTOMATION_HOME" ]]; then
    mv "$AUTOMATION_HOME" "$backup_dir"
  fi

  mv "$staging_dir" "$AUTOMATION_HOME"
  rm -rf "$backup_dir"
  mkdir -p "$AUTOMATION_LOGS_DIR" "$AUTOMATION_DOWNLOADS_DIR" "$AUTOMATION_TEMP_DIR"
}

migrate_legacy_n8n_data() {
  mkdir -p "$AUTOMATION_DATA_DIR"
  if find "$AUTOMATION_DATA_DIR" -mindepth 1 -print -quit 2>/dev/null | grep -q .; then
    return
  fi

  for candidate in "$HOME/.n8n" "${XDG_CONFIG_HOME:-$HOME/.config}/n8n"; do
    if [[ -d "$candidate" ]]; then
      log "Migrating existing n8n data from $candidate to $AUTOMATION_DATA_DIR."
      copy_runtime_tree "$candidate" "$AUTOMATION_DATA_DIR"
      return
    fi
  done
}

ensure_runtime_installed() {
  ensure_sufficient_disk_space

  if manifest_matches_expected; then
    migrate_legacy_n8n_data
    log "Pinned automation runtime already present at $AUTOMATION_HOME."
    return
  fi

  local source_path checksum_sidecar
  source_path="$(resolve_runtime_source)"
  if [[ -f "$source_path" ]]; then
    checksum_sidecar="${source_path}.sha256"
    if [[ -f "$checksum_sidecar" ]]; then
      verify_checksum "$source_path" "$checksum_sidecar"
    fi
  fi

  materialize_runtime "$source_path"
  migrate_legacy_n8n_data

  if ! manifest_matches_expected; then
    rm -rf "$AUTOMATION_HOME"
    echo "Runtime installation completed, but the extracted runtime is incomplete or invalid." >&2
    return 1
  fi

  log "Pinned automation runtime is ready at $AUTOMATION_HOME."
}

node_path() {
  printf '%s\n' "$AUTOMATION_HOME/node/bin/node"
}

n8n_cli_path() {
  printf '%s\n' "$AUTOMATION_HOME/prefix/lib/node_modules/n8n/bin/n8n"
}

test_n8n_ready() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time "$N8N_READY_TIMEOUT_SECONDS" "$N8N_READY_URL" >/dev/null 2>&1
    return
  fi

  wget -q --timeout="$N8N_READY_TIMEOUT_SECONDS" -O /dev/null "$N8N_READY_URL"
}

wait_for_n8n() {
  local attempts max_attempts
  attempts=0
  max_attempts=$((N8N_STARTUP_TIMEOUT_SECONDS / N8N_STARTUP_INTERVAL_SECONDS))
  while [[ "$attempts" -lt "$max_attempts" ]]; do
    if test_n8n_ready; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep "$N8N_STARTUP_INTERVAL_SECONDS"
  done
  return 1
}

listening_pid() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$N8N_PORT" -sTCP:LISTEN 2>/dev/null | head -n1
    return
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "( sport = :$N8N_PORT )" 2>/dev/null | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -n1
  fi
}

stop_pid_if_running() {
  local pid="$1"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi
}

ensure_n8n_running() {
  if test_n8n_ready; then
    log "n8n is already healthy at $N8N_READY_URL."
    save_status true "\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\""
    return
  fi

  local existing_pid
  existing_pid="$(listening_pid || true)"
  if [[ -n "$existing_pid" ]]; then
    if [[ -f "$PID_FILE" && "$(cat "$PID_FILE" 2>/dev/null)" = "$existing_pid" ]]; then
      log "Detected existing Drodo-owned n8n process $existing_pid on port $N8N_PORT; waiting for readiness."
      if wait_for_n8n; then
        save_status true "\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\""
        log "n8n is healthy at $N8N_READY_URL."
        return
      fi
      stop_pid_if_running "$existing_pid"
      rm -f "$PID_FILE"
    else
      echo "Port $N8N_PORT is already in use by another process${existing_pid:+ (PID $existing_pid)}." >&2
      return 1
    fi
  fi

  mkdir -p "$AUTOMATION_DATA_DIR" "$AUTOMATION_TEMP_DIR"
  rm -f "$RUNTIME_LOG_FILE" "$RUNTIME_ERR_LOG_FILE"
  nohup env \
    N8N_USER_FOLDER="$AUTOMATION_DATA_DIR" \
    TMPDIR="$AUTOMATION_TEMP_DIR" \
    TEMP="$AUTOMATION_TEMP_DIR" \
    TMP="$AUTOMATION_TEMP_DIR" \
    "$(node_path)" "$(n8n_cli_path)" start >>"$RUNTIME_LOG_FILE" 2>>"$RUNTIME_ERR_LOG_FILE" &
  echo $! >"$PID_FILE"
  log "Started pinned n8n process $(cat "$PID_FILE")."

  if ! wait_for_n8n; then
    stop_pid_if_running "$(cat "$PID_FILE" 2>/dev/null || true)"
    rm -f "$PID_FILE"
    echo "n8n did not become healthy at $N8N_READY_URL. See $RUNTIME_LOG_FILE and $RUNTIME_ERR_LOG_FILE for details." >&2
    return 1
  fi

  save_status true "\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\""
  log "n8n is healthy at $N8N_READY_URL."
}

error_category_for_message() {
  local message="$1"
  case "$message" in
    *"Insufficient disk space"*) echo "DiskSpace" ;;
    *"Checksum"* ) echo "RuntimeChecksum" ;;
    *"download"* ) echo "RuntimeDownload" ;;
    *"Port 5678 is already in use"* ) echo "PortConflict" ;;
    *"healthy"*|*"did not become healthy"* ) echo "N8nStartup" ;;
    *"Runtime installation completed"* ) echo "RuntimeExtraction" ;;
    * ) echo "BootstrapFailure" ;;
  esac
}

main() {
  clear_last_error
  log "Starting Drodo automation runtime bootstrap."
  log "Resolved Drodo app version $APP_VERSION."
  ensure_runtime_installed
  ensure_n8n_running
  log "Drodo automation runtime bootstrap completed successfully."
}

if ! output="$(main 2>&1)"; then
  message="${output##*$'\n'}"
  category="$(error_category_for_message "$message")"
  log "Drodo automation runtime bootstrap failed [$category]: $message"
  save_status false null "$(json_string_or_null "$category")" "$(json_string_or_null "$message")"
  save_last_error "$category" "$message"
  printf '%s\n' "$output" >&2
  exit 1
fi
