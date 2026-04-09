#!/usr/bin/env bash

set -euo pipefail

N8N_PORT=5678
DRODO_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/Drodo"
LOG_FILE="$DRODO_DIR/install.log"
STATUS_FILE="$DRODO_DIR/n8n-status.json"

mkdir -p "$DRODO_DIR"

log() {
  printf '%s %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$1" >>"$LOG_FILE"
}

save_status() {
  local running="$1"
  local started_at="${2:-null}"

  cat >"$STATUS_FILE" <<EOF
{
  "running": $running,
  "port": $N8N_PORT,
  "startedAt": $started_at
}
EOF
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

node_major_version() {
  if ! command_exists node; then
    echo ""
    return 0
  fi

  node -v | sed -E 's/^v([0-9]+).*/\1/'
}

install_node_with_brew() {
  if command_exists brew; then
    log "Installing Node.js with Homebrew."
    brew install node
    return 0
  fi
  return 1
}

install_node_with_apt() {
  if command_exists apt-get; then
    log "Installing Node.js with apt using the NodeSource 22.x repository."
    if command_exists sudo; then
      curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
      sudo apt-get install -y nodejs
    else
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      apt-get install -y nodejs
    fi
    return 0
  fi
  return 1
}

install_git_with_brew() {
  if command_exists brew; then
    log "Installing Git with Homebrew."
    brew install git
    return 0
  fi
  return 1
}

install_git_with_apt() {
  if command_exists apt-get; then
    log "Installing Git with apt."
    if command_exists sudo; then
      sudo apt-get update
      sudo apt-get install -y git
    else
      apt-get update
      apt-get install -y git
    fi
    return 0
  fi
  return 1
}

ensure_node_installed() {
  local major
  major="$(node_major_version)"

  if [[ -n "$major" && "$major" -ge 18 ]]; then
    log "Node.js already available (major=$major)."
    return 0
  fi

  if install_node_with_brew || install_node_with_apt; then
    major="$(node_major_version)"
    if [[ -n "$major" && "$major" -ge 18 ]]; then
      log "Node.js installed successfully (major=$major)."
      return 0
    fi
  fi

  log "Failed to install Node.js >= 18."
  return 1
}

ensure_git_installed() {
  if command_exists git; then
    log "Git already available."
    return 0
  fi

  if install_git_with_brew || install_git_with_apt; then
    if command_exists git; then
      log "Git installed successfully."
      return 0
    fi
  fi

  log "Failed to install Git."
  return 1
}

ensure_n8n_installed() {
  log "Checking for a global n8n installation."
  if npm list -g n8n --depth=0 >/dev/null 2>&1; then
    log "n8n is already installed globally."
    return 0
  fi

  log "n8n not found globally. Installing with npm."
  npm install -g n8n --silent >/dev/null
  log "n8n installed successfully."
}

n8n_is_running() {
  if command_exists curl && curl -fsI "http://127.0.0.1:${N8N_PORT}" >/dev/null 2>&1; then
    return 0
  fi

  if command_exists lsof && lsof -iTCP:"$N8N_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

resolve_n8n_command() {
  if command_exists n8n; then
    command -v n8n
    return 0
  fi

  local npm_prefix
  npm_prefix="$(npm prefix -g 2>/dev/null || true)"
  if [[ -n "$npm_prefix" && -x "$npm_prefix/bin/n8n" ]]; then
    printf '%s\n' "$npm_prefix/bin/n8n"
    return 0
  fi

  return 1
}

ensure_n8n_running() {
  if n8n_is_running; then
    log "n8n is already listening on port ${N8N_PORT}."
    save_status true "\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\""
    return 0
  fi

  local n8n_cmd
  n8n_cmd="$(resolve_n8n_command)"
  if [[ -z "$n8n_cmd" ]]; then
    log "Unable to resolve the n8n executable."
    return 1
  fi

  log "Starting n8n in the background using ${n8n_cmd}."
  nohup "$n8n_cmd" start >>"$LOG_FILE" 2>&1 &

  for _ in $(seq 1 30); do
    if n8n_is_running; then
      local started_at
      started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
      save_status true "\"$started_at\""
      log "n8n is now listening on port ${N8N_PORT}."
      return 0
    fi
    sleep 2
  done

  log "n8n did not become ready on port ${N8N_PORT} in time."
  save_status false null
  return 1
}

main() {
  log "Starting Drodo dependency bootstrap."
  ensure_node_installed
  ensure_git_installed
  ensure_n8n_installed
  ensure_n8n_running
  log "Drodo dependency bootstrap completed successfully."
}

if ! main; then
  log "Drodo dependency bootstrap failed."
  save_status false null
  exit 1
fi
